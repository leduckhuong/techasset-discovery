"""
TechAsset Discovery — Backend API
=================================
Quét tech stack theo subdomain/URL + nhận CVE từ bot ngoài + cảnh báo asset bị ảnh hưởng.

Contract API khớp 100% với frontend (src/types.ts + các fetch() trong App.tsx)
và webhook /api/cve/push cho con bot đẩy CVE.
"""
import asyncio
import logging
import re
import shutil
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Body, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from . import ai, config, csv_template, cve_engine, db, discovery, httpx_engine, import_pipeline, inventory, logs, nuclei_engine, scheduler, scanner, security, telegram

logs.setup_logging()
log = logging.getLogger("api")

PRESETS = [
    {
        "name": "Vue & Quasar Ecosystem",
        "description": "Các cổng thông tin và tài liệu chính thức của Vue & Quasar",
        "urls": ["https://quasar.dev", "https://vuejs.org", "https://nuxt.com",
                 "https://pinia.vuejs.org", "https://vite.dev"],
    },
    {
        "name": "Global Tech & Cloud Assets",
        "description": "Hạ tầng CDN, SaaS, Web Server toàn cầu",
        "urls": ["https://github.com", "https://cloudflare.com", "https://vercel.com",
                 "https://wordpress.org", "https://shopify.com"],
    },
    {
        "name": "Vietnam Tech & Portals",
        "description": "Một số cổng tin tức và công nghệ tại Việt Nam",
        "urls": ["https://vnexpress.net", "https://dantri.com.vn",
                 "https://tiki.vn", "https://vietnamnet.vn"],
    },
]

DOMAIN_RE = re.compile(
    r"([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d{1,5})?"
)
VALID_HOST_RE = re.compile(
    r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)
KNOWN_COLS = ["subdomain", "domain", "host", "hostname", "url", "target", "asset", "fqdn"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="TechAsset Discovery API", version=config.APP_VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Login (user + password + TOTP 2FA) bảo vệ toàn bộ app.
    Bot/API ngoài đi qua header X-API-Key. /api/health và /login miễn."""
    if security.enabled() and not security.request_authorized(request):
        if request.url.path.startswith("/api/"):
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Unauthorized — đăng nhập hoặc gửi X-API-Key"}, status_code=401)
        from fastapi.responses import RedirectResponse
        return RedirectResponse("/login", status_code=303)
    return await call_next(request)


security.register_login_routes(app)


def require_push_auth(x_api_key: str | None = Header(default=None)) -> None:
    """Nếu cấu hình CVE_PUSH_API_KEY thì webhook bắt buộc header X-API-Key."""
    if config.CVE_PUSH_API_KEY and x_api_key != config.CVE_PUSH_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key header")


# ============================== Health & Presets ==============================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "tool": "tech-discovery-scanner",
        "version": config.APP_VERSION,
        "nuclei": nuclei_engine.nuclei_available(),
        "subfinder": shutil.which("subfinder") is not None,
        "httpx": httpx_engine.httpx_available(),
    }


@app.get("/api/presets")
def presets():
    return PRESETS


# ============================== Scanning ==============================

def _scan_options(options: dict | None) -> dict:
    options = options or {}
    return {
        "timeout": options.get("timeoutSec") or config.SCAN_DEFAULT_TIMEOUT,
        "threads": options.get("threads") or 5,
        "tech_detect": options.get("techDetect", True),
        "follow": options.get("followRedirects", True),
        "nuclei": bool(options.get("nuclei")),
    }


@app.post("/api/scan-single")
def scan_single(payload: dict = Body(...)):
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    result = scanner.scan_target(
        url,
        timeout_sec=payload.get("timeout"),
        tech_detect=payload.get("techDetect", True),
        follow_redirects=payload.get("followRedirects", True),
        asset_group_id=payload.get("assetGroupId"),
        use_nuclei=bool(payload.get("nuclei")),
    )
    if isinstance(payload.get("meta"), dict) and payload["meta"]:
        result["meta"] = payload["meta"]
    with db.get_conn() as conn:
        inventory.upsert_asset(conn, result)
        cve_engine.run_agent(conn)
    return result


@app.post("/api/scan")
def scan_bulk(payload: dict = Body(...)):
    urls = payload.get("urls")
    if not isinstance(urls, list) or not urls:
        raise HTTPException(status_code=400, detail="URLs array is required")
    opts = _scan_options(payload.get("options"))
    results = scanner.scan_many(
        urls, timeout_sec=opts["timeout"], threads=opts["threads"],
        tech_detect=opts["tech_detect"], follow_redirects=opts["follow"],
        use_nuclei=opts["nuclei"],
    )
    with db.get_conn() as conn:
        for res in results:
            inventory.upsert_asset(conn, res)
        cve_engine.run_agent(conn)
    return {
        "total": len(results),
        "successful": sum(1 for r in results if r.get("statusCode", 0) > 0),
        "results": results,
    }


# ============================== CSV Parsing ==============================

@app.post("/api/parse-csv")
def parse_csv(payload: dict = Body(...)):
    content = payload.get("content")
    if not content or not isinstance(content, str):
        raise HTTPException(status_code=400, detail="Content string is required")

    # Template cố định "domain list" (header DOMAIN + cột metadata): giữ full thông tin
    if csv_template.is_domain_template(content):
        return csv_template.parse(content, payload.get("fileName"))

    # Fallback: danh sách subdomain thuần (1 cột, có/không header)

    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    if not lines:
        return {"total": 0, "valid": 0, "items": [], "subdomains": []}

    first_line = lines[0]
    delimiter = ","
    if "\t" in first_line:
        delimiter = "\t"
    elif ";" in first_line and "," not in first_line:
        delimiter = ";"

    header_parts = [
        p.strip().strip("\"'").lower() for p in first_line.split(delimiter)
    ]
    target_col = 0
    has_header = False
    matched_idx = next(
        (i for i, p in enumerate(header_parts) if any(k in p for k in KNOWN_COLS)), -1
    )
    if matched_idx != -1:
        target_col = matched_idx
        has_header = True
    elif re.fullmatch(r"[a-zA-Z_\s]+", first_line) and "." not in first_line:
        has_header = True

    data_rows = lines[1:] if has_header else lines
    discovered: dict[str, dict] = {}

    for row in data_rows:
        cols = [c.strip().strip("\"'") for c in row.split(delimiter)]
        candidate = cols[target_col] if target_col < len(cols) and cols[target_col] else (cols[0] if cols else "")
        if not candidate or not DOMAIN_RE.search(candidate or ""):
            m = DOMAIN_RE.search(row)
            candidate = m.group(0) if m else candidate
        if not candidate:
            continue

        clean = candidate.strip().lower()
        scheme, port = "https", 443
        if clean.startswith("http://"):
            scheme, port = "http", 80
            clean = clean[len("http://"):]
        elif clean.startswith("https://"):
            clean = clean[len("https://"):]
        slash = clean.find("/")
        if slash != -1:
            clean = clean[:slash]
        if ":" in clean:
            host_part, _, port_part = clean.partition(":")
            try:
                p = int(port_part)
                if 0 < p <= 65535:
                    clean, port = host_part, p
            except ValueError:
                clean = host_part

        if not clean or clean in discovered:
            continue
        discovered[clean] = {
            "subdomain": clean,
            "detectedScheme": scheme,
            "port": port,
            "normalizedUrl": f"{scheme}://{clean}{'' if port in (80, 443) else f':{port}'}",
            "isValid": bool(VALID_HOST_RE.match(clean)),
        }

    items = list(discovered.values())
    valid = [i for i in items if i["isValid"]]
    return {
        "fileName": payload.get("fileName") or "imported_subdomains.csv",
        "totalRows": len(lines),
        "discoveredTotal": len(items),
        "validTotal": len(valid),
        "items": items,
        "normalizedUrls": [i["normalizedUrl"] for i in valid],
    }


# ============================== Assets ==============================

@app.get("/api/assets")
def list_assets():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM assets ORDER BY timestamp DESC").fetchall()
        return {"total": len(rows), "assets": [db.asset_row_to_dict(r) for r in rows]}


@app.post("/api/assets")
def add_asset(payload: dict = Body(...)):
    if not payload.get("url"):
        raise HTTPException(status_code=400, detail="Asset data with valid URL is required")
    result = {
        "id": payload.get("id"),
        "url": payload["url"],
        "host": payload.get("host") or re.sub(r"^https?://", "", payload["url"]).split("/")[0],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **{k: v for k, v in payload.items() if k not in ("url", "id", "host", "timestamp")},
    }
    with db.get_conn() as conn:
        inventory.upsert_asset(conn, result)
        alerts = cve_engine.run_agent(conn)
        total = conn.execute("SELECT COUNT(*) c FROM assets").fetchone()["c"]
    return {"success": True, "totalAssets": total, "activeAlerts": len(alerts)}


@app.delete("/api/assets/{asset_id}")
def delete_asset(asset_id: str):
    with db.get_conn() as conn:
        conn.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
        conn.execute("DELETE FROM cve_alerts WHERE matched_asset_id = ?", (asset_id,))
        remaining = conn.execute("SELECT COUNT(*) c FROM assets").fetchone()["c"]
    return {"success": True, "remaining": remaining}


# ============================== Asset Groups ==============================

@app.get("/api/asset-groups")
def list_groups():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM asset_groups ORDER BY created_at DESC").fetchall()
        return [db.group_row_to_dict(r) for r in rows]


@app.post("/api/asset-groups")
def create_group(payload: dict = Body(...)):
    name = (payload.get("name") or "").strip()
    root_domain = (payload.get("rootDomain") or "").strip().lower()
    if not name or not root_domain:
        raise HTTPException(status_code=400, detail="Name and rootDomain are required")
    group = {
        "id": db.new_id("group"),
        "name": name,
        "rootDomain": root_domain,
        "description": payload.get("description") or "",
        "subdomains": payload.get("subdomains") or [],
        "tags": payload.get("tags") or ["Custom Group"],
        "meta": payload.get("meta") or {},
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "lastScanned": datetime.now(timezone.utc).isoformat(),
    }
    with db.get_conn() as conn:
        conn.execute(
            """INSERT INTO asset_groups (id, name, root_domain, description,
               subdomains_json, tags_json, meta_json, created_at, last_scanned)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (group["id"], group["name"], group["rootDomain"], group["description"],
             db.dumps(group["subdomains"]), db.dumps(group["tags"]),
             db.dumps(group["meta"]) if group["meta"] else None,
             group["createdAt"], group["lastScanned"]),
        )
    return {**group, "assetCount": len(group["subdomains"])}


@app.patch("/api/asset-groups/{group_id}")
def update_group(group_id: str, payload: dict = Body(...)):
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM asset_groups WHERE id=?", (group_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Asset group not found")
        updates, params = [], []
        if (payload.get("name") or "").strip():
            updates.append("name=?")
            params.append(payload["name"].strip())
        if payload.get("description") is not None:
            updates.append("description=?")
            params.append(payload["description"])
        if isinstance(payload.get("subdomains"), list):
            updates.append("subdomains_json=?")
            params.append(db.dumps(payload["subdomains"]))
        if isinstance(payload.get("tags"), list):
            updates.append("tags_json=?")
            params.append(db.dumps(payload["tags"]))
        if isinstance(payload.get("meta"), dict):
            old_meta = db.loads(row["meta_json"], {}) or {}
            updates.append("meta_json=?")
            params.append(db.dumps({**old_meta, **payload["meta"]}))
        if updates:
            params.append(group_id)
            conn.execute(f"UPDATE asset_groups SET {', '.join(updates)} WHERE id=?", params)
        row = conn.execute("SELECT * FROM asset_groups WHERE id=?", (group_id,)).fetchone()
        return db.group_row_to_dict(row)


# ============================== Cron Scan Jobs ==============================

@app.get("/api/cron-jobs")
def list_jobs():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM cron_jobs ORDER BY name").fetchall()
        return {"jobs": [db.job_row_to_dict(r) for r in rows],
                "serverTime": datetime.now(timezone.utc).isoformat()}


@app.post("/api/cron-jobs")
def create_job(payload: dict = Body(...)):
    name = (payload.get("name") or "").strip()
    cron_expression = (payload.get("cronExpression") or "").strip()
    target_urls = payload.get("targetUrls") or []
    if not name or not cron_expression or not target_urls:
        raise HTTPException(
            status_code=400,
            detail="Name, cronExpression, and targetUrls are required",
        )
    try:
        from apscheduler.triggers.cron import CronTrigger
        CronTrigger.from_crontab(cron_expression, timezone=config.SCHEDULER_TZ)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {exc}")

    options = payload.get("options") or {
        "techDetect": True, "statusCode": True, "title": True,
        "followRedirects": True, "probe": True,
        "timeoutSec": config.SCAN_DEFAULT_TIMEOUT, "threads": 5,
    }
    job_id = db.new_id("cron")
    next_run = scheduler.next_run_for(cron_expression)
    with db.get_conn() as conn:
        conn.execute(
            """INSERT INTO cron_jobs (id, name, cron_expression, schedule_human,
               target_type, target_group_id, target_urls_json, options_json, enabled,
               next_run, total_runs, notify_on_new_assets)
               VALUES (?,?,?,?,?,?,?,?,1,?,0,?)""",
            (job_id, name, cron_expression,
             payload.get("scheduleHuman") or "Custom schedule",
             payload.get("targetType") or "subdomain-list",
             payload.get("targetGroupId"), db.dumps(target_urls), db.dumps(options),
             next_run, 1 if payload.get("notifyOnNewAssets") else 0),
        )
    scheduler.refresh()  # ngoài transaction để tránh SQLite write-lock
    with db.get_conn() as conn:  # connection mới để thấy dữ liệu refresh() vừa ghi
        row = conn.execute("SELECT * FROM cron_jobs WHERE id=?", (job_id,)).fetchone()
        return db.job_row_to_dict(row)


@app.patch("/api/cron-jobs/{job_id}")
def update_job(job_id: str, payload: dict = Body(...)):
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM cron_jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cron job not found")
        updates, params = [], []
        for column, key, cast in (
            ("name", "name", str), ("cron_expression", "cronExpression", str),
            ("schedule_human", "scheduleHuman", str), ("target_type", "targetType", str),
            ("target_group_id", "targetGroupId", str),
        ):
            if payload.get(key) is not None:
                updates.append(f"{column}=?")
                params.append(cast(payload[key]))
        if "enabled" in payload and isinstance(payload["enabled"], bool):
            updates.append("enabled=?")
            params.append(1 if payload["enabled"] else 0)
        if "notifyOnNewAssets" in payload and isinstance(payload["notifyOnNewAssets"], bool):
            updates.append("notify_on_new_assets=?")
            params.append(1 if payload["notifyOnNewAssets"] else 0)
        if isinstance(payload.get("targetUrls"), list):
            updates.append("target_urls_json=?")
            params.append(db.dumps(payload["targetUrls"]))
        if isinstance(payload.get("options"), dict):
            updates.append("options_json=?")
            params.append(db.dumps(payload["options"]))
        if updates:
            params.append(job_id)
            conn.execute(f"UPDATE cron_jobs SET {', '.join(updates)} WHERE id=?", params)
    scheduler.refresh()
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM cron_jobs WHERE id=?", (job_id,)).fetchone()
        return db.job_row_to_dict(row)


@app.delete("/api/cron-jobs/{job_id}")
def delete_job(job_id: str):
    with db.get_conn() as conn:
        cur = conn.execute("DELETE FROM cron_jobs WHERE id=?", (job_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Cron job not found")
        scheduler.refresh()
    return {"success": True, "message": "Cron job deleted"}


@app.post("/api/cron-jobs/{job_id}/run")
def run_job(job_id: str):
    outcome = scheduler.execute_job_sync(job_id)
    if "error" in outcome:
        raise HTTPException(status_code=404, detail=outcome["error"])
    return outcome


# ============================== CVEs (Bot Webhook) ==============================

@app.get("/api/cve/list")
def list_cves():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM cves ORDER BY pushed_at DESC").fetchall()
        return {"total": len(rows), "cves": [db.cve_row_to_dict(r) for r in rows]}


@app.post("/api/cve/push")
async def push_cve(payload: dict = Body(...), x_api_key: str | None = Header(default=None)):
    require_push_auth(x_api_key)
    missing = [k for k in ("cveId", "software", "affectedVersions") if not payload.get(k)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=("Missing required parameters. Required: cveId (e.g. CVE-2023-25690), "
                    f"software (e.g. Apache), affectedVersions (e.g. < 2.4.56) — thiếu: {', '.join(missing)}"),
        )
    with db.get_conn() as conn:
        result = cve_engine.push_cve(conn, payload)
        result["telegramSent"] = getattr(cve_engine.run_agent, "last_new_count", 0)
    return result


@app.get("/api/cve/alerts")
def list_alerts(status: str | None = Query(default=None),
                severity: str | None = Query(default=None)):
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM cve_alerts ORDER BY detected_at DESC").fetchall()
    alerts = [db.alert_row_to_dict(r) for r in rows]
    if status:
        alerts = [a for a in alerts if a["status"] == status]
    if severity:
        alerts = [a for a in alerts if a["severity"].lower() == severity.lower()]
    return {
        "total": len(alerts),
        "activeCount": sum(1 for a in alerts if a["status"] == "active"),
        "criticalCount": sum(1 for a in alerts if a["severity"] == "CRITICAL"),
        "alerts": alerts,
    }


@app.patch("/api/cve/alerts/{alert_id}")
def update_alert(alert_id: str, payload: dict = Body(...)):
    status = payload.get("status")
    if status not in ("active", "investigating", "resolved"):
        raise HTTPException(
            status_code=400,
            detail="status must be one of: active, investigating, resolved",
        )
    with db.get_conn() as conn:
        cur = conn.execute("UPDATE cve_alerts SET status=? WHERE id=?", (status, alert_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        row = conn.execute("SELECT * FROM cve_alerts WHERE id=?", (alert_id,)).fetchone()
        return {"success": True, "alert": db.alert_row_to_dict(row)}


@app.post("/api/cve/agent/run")
def agent_run():
    with db.get_conn() as conn:
        alerts = cve_engine.run_agent(conn)
        n_assets = conn.execute("SELECT COUNT(*) c FROM assets").fetchone()["c"]
        n_cves = conn.execute("SELECT COUNT(*) c FROM cves").fetchone()["c"]
    return {
        "success": True,
        "totalScannedAssets": n_assets,
        "totalCves": n_cves,
        "totalAlertsMatched": len(alerts),
        "alerts": alerts,
    }


@app.get("/api/cve/bot-webhook-info")
def bot_webhook_info():
    with db.get_conn() as conn:
        n_assets = conn.execute("SELECT COUNT(*) c FROM assets").fetchone()["c"]
        n_cves = conn.execute("SELECT COUNT(*) c FROM cves").fetchone()["c"]
    base = f"http://localhost:{config.PORT}"
    return {
        "webhookUrl": f"{base}/api/cve/push",
        "method": "POST",
        "contentType": "application/json",
        "requiresApiKey": bool(config.CVE_PUSH_API_KEY),
        "apiKeyHeader": "X-API-Key" if config.CVE_PUSH_API_KEY else None,
        "samplePayload": {
            "cveId": "CVE-2023-25690",
            "software": "Apache",
            "affectedVersions": "< 2.4.56",
            "severity": "CRITICAL",
            "cvssScore": 9.8,
            "summary": "HTTP Request Smuggling in mod_proxy",
            "remediation": "Upgrade Apache HTTP Server to >= 2.4.56",
            "source": "Telegram Security Bot",
        },
        "curlExample": (
            f'curl -X POST {base}/api/cve/push -H "Content-Type: application/json" '
            f'-d \'{{"cveId":"CVE-2023-25690","software":"Apache",'
            f'"affectedVersions":"< 2.4.56","severity":"CRITICAL","cvssScore":9.8,'
            f'"summary":"HTTP Request Smuggling in mod_proxy","source":"Telegram Alert Bot"}}\''
        ),
        "totalAssetsMonitored": n_assets,
        "activeCveRulesCount": n_cves,
    }


# ============================== Port Probing (httpx) ==============================

@app.post("/api/probe-ports")
async def probe_ports(payload: dict = Body(...)):
    """
    Dò web port phổ biến (mặc định 79 ports) trên danh sách host bằng httpx.
    Service tìm thấy được lưu thẳng vào assets (kèm tech detect của httpx) và
    chạy CVE agent ngay. Body: {hosts: [...], ports?: "80,443,...", assetGroupId?}
    """
    raw_hosts = payload.get("hosts") or []
    if not isinstance(raw_hosts, list) or not raw_hosts:
        raise HTTPException(status_code=400, detail="hosts array is required")

    if not httpx_engine.httpx_available():
        raise HTTPException(status_code=502, detail="httpx binary not found in PATH (go install github.com/projectdiscovery/httpx/cmd/httpx@latest)")

    ports = payload.get("ports")
    if isinstance(ports, list):
        ports = ",".join(str(p) for p in ports)
    if not ports or not str(ports).strip():
        ports = httpx_engine.DEFAULT_WEB_PORTS

    try:
        entries = await httpx_engine.probe_hosts([str(h) for h in raw_hosts], str(ports).strip())
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    group_id = payload.get("assetGroupId")
    probe_started = time.monotonic()
    results = []
    with db.get_conn() as conn:
        for entry in entries:
            result = httpx_engine.build_scan_result(entry, group_id)
            if not result:
                continue
            inventory.upsert_asset(conn, result)
            results.append(result)
        cve_engine.run_agent(conn)

    log.info("httpx %d hosts × %s ports -> %d services | %.1fs", len(raw_hosts), ports, len(results), time.monotonic() - probe_started)
    return {
        "success": True,
        "probedHosts": len(raw_hosts),
        "ports": str(ports),
        "total": len(results),
        "results": results,
    }


# ============================== Subdomain Discovery (subfinder / crt.sh) ==============================

@app.post("/api/discover-subdomains")
async def discover_subdomains(payload: dict = Body(...)):
    root = (payload.get("rootDomain") or "").strip().lower().replace("*.", "")
    if not root or not VALID_HOST_RE.match(root):
        raise HTTPException(status_code=400, detail="A valid rootDomain is required")
    engine = (payload.get("engine") or "auto").lower()
    if engine not in ("auto", "subfinder", "crtsh"):
        engine = "auto"

    started = time.monotonic()
    try:
        subdomains, engine_used, note = await discovery.discover(root, engine)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    log.info("discover %s -> %d sub (%s) | %.1fs%s", root, len(subdomains), engine_used, time.monotonic() - started, f" | {note}" if note else "")
    return {
        "rootDomain": root,
        "engine": engine_used,
        "note": note,
        "total": len(subdomains),
        "subdomains": sorted(subdomains),
    }


# ============================== Telegram & AI ==============================

@app.post("/api/telegram/test")
async def telegram_test():
    ok, detail = await asyncio.to_thread(
        telegram.send_message,
        "✅ <b>TechAsset Discovery</b> đã kết nối Telegram bot thành công.\nCVE alerts sẽ được đẩy vào nhóm này.",
    )
    return {"success": ok, "detail": detail}


@app.post("/api/ai/analyze")
async def ai_analyze(payload: dict = Body(...)):
    alert_id = payload.get("alertId")
    if not alert_id:
        raise HTTPException(status_code=400, detail="alertId is required")
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM cve_alerts WHERE id = ?", (alert_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = db.alert_row_to_dict(row)
    ok, answer = await ai.chat(ai.SYSTEM_PROMPT, ai.build_cve_prompt(alert))
    return {"success": ok, "answer": answer if ok else None, "error": None if ok else answer}


# ============================== Import pipeline (chạy nền trên server) ==============================

@app.post("/api/import-scan")
def start_import_scan(payload: dict = Body(...)):
    """Đăng ký pipeline import chạy nền: {items, config, timeoutSec}. Trả về jobId."""
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="items array is required")
    cfg = payload.get("config") or {}
    timeout_sec = int(payload.get("timeoutSec") or config.SCAN_DEFAULT_TIMEOUT)
    job_id = import_pipeline.start_job(items, cfg, timeout_sec)
    log.info("import job %s đăng ký: %d items | cfg=%s", job_id, len(items), cfg)
    return {"success": True, "jobId": job_id}


@app.get("/api/import-jobs/{job_id}")
def get_import_job(job_id: str):
    job = import_pipeline.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ============================== Frontend static (production) ==============================
# Nếu tồn tại frontend/dist (chạy `npm run build` trong frontend/), backend sẽ
# serve dashboard luôn — deploy production chỉ cần 1 tiến trình duy nhất.
_FRONTEND_DIST = config.BASE_DIR.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = _FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
