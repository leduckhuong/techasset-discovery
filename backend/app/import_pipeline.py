"""
Import pipeline — chạy NỀN trên server (background thread).

Pipeline: tạo asset group theo domain gốc
  -> [1] subfinder dò sub từng domain gốc (merge vào group)
  -> [2] quét tech từng mục tiêu (+ nuclei tuỳ chọn)
  -> [3] httpx dò 79 web port trên host của từng group
Toàn bộ tiến độ/status lưu trong _jobs — trình duyệt đóng/refresh không ảnh hưởng.
"""
import asyncio
import logging
import threading
import uuid
from datetime import datetime, timezone

from . import cve_engine, db, discovery, httpx_engine, inventory, scanner

log = logging.getLogger("import-pipeline")

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _log(job: dict, msg: str) -> None:
    line = f"{_now()} {msg}"
    job["log"].append(line)
    if len(job["log"]) > 500:
        del job["log"][: len(job["log"]) - 500]
    log.info("[import %s] %s", job["id"], msg)


def _set(job: dict, phase: str, progress: int) -> None:
    job["phase"] = phase
    job["progress"] = progress


def start_job(items: list[dict], cfg: dict, timeout_sec: int, workspace_id: str | None = None) -> str:
    job_id = f"imp-{uuid.uuid4().hex[:10]}"
    job = {
        "id": job_id,
        "status": "queued",
        "phase": "Trong hàng đợi...",
        "progress": 0,
        "log": [],
        "stats": {},
        "summary": None,
        "error": None,
        "createdAt": _now(),
    }
    with _lock:
        _jobs[job_id] = job
        # giữ tối đa 20 job gần nhất
        if len(_jobs) > 20:
            for old in sorted(_jobs, key=lambda k: _jobs[k]["createdAt"])[: len(_jobs) - 20]:
                if _jobs[old]["status"] in ("done", "error"):
                    _jobs.pop(old)
    threading.Thread(target=_run, args=(job_id, items, cfg, timeout_sec, workspace_id), daemon=True).start()
    return job_id


def _upsert_group(conn, root: str, name: str, subdomains: list[str], tags: list[str],
                  meta: dict, workspace_id: str | None = None) -> str:
    row = conn.execute(
        "SELECT id, subdomains_json, meta_json FROM asset_groups WHERE root_domain = ?", (root,)
    ).fetchone()
    if row:
        old_subs = db.loads(row["subdomains_json"], []) or []
        merged = list(dict.fromkeys(old_subs + subdomains))
        old_meta = db.loads(row["meta_json"], {}) or {}
        merged_meta = {**old_meta, **{k: v for k, v in meta.items() if v}}
        conn.execute(
            "UPDATE asset_groups SET subdomains_json=?, meta_json=? WHERE id=?",
            (db.dumps(merged), db.dumps(merged_meta), row["id"]),
        )
        if workspace_id and not row["workspace_id"]:
            conn.execute("UPDATE asset_groups SET workspace_id=? WHERE id=?", (workspace_id, row["id"]))
        return row["id"]
    group_id = f"group-{uuid.uuid4().hex[:8]}"
    conn.execute(
        """INSERT INTO asset_groups (id, name, root_domain, description, subdomains_json,
           tags_json, meta_json, workspace_id, created_at, last_scanned)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (
            group_id, name, root,
            "Import pipeline — domain list",
            db.dumps(subdomains), db.dumps(tags), db.dumps(meta) if meta else None,
            workspace_id, _now(), _now(),
        ),
    )
    return group_id


def _run(job_id: str, items: list[dict], cfg: dict, timeout_sec: int, workspace_id: str | None = None) -> None:
    with _lock:
        job = _jobs[job_id]
    job["status"] = "running"
    stats = {"groups": 0, "subsFound": 0, "techOk": 0, "techTotal": len(items), "portServices": 0, "errors": 0}
    job["stats"] = stats
    _log(job, f"Bắt đầu pipeline: {len(items)} mục tiêu | tech={cfg.get('techScan')} subfinder={cfg.get('discoverSubs')} httpx={cfg.get('portScan')} nuclei={cfg.get('nuclei')}")

    template_mode = any(i.get("rootDomain") for i in items)

    # ---- Tạo asset group theo domain gốc ----
    _set(job, "Tạo asset group theo domain gốc...", 5)
    groups: dict[str, dict] = {}
    if template_mode:
        with db.get_conn() as conn:
            roots: dict[str, dict] = {}
            for it in items:
                root = it.get("rootDomain")
                if not root:
                    continue
                info = roots.setdefault(root, {"subdomains": [], "meta": {}, "projects": []})
                if it["subdomain"] not in info["subdomains"]:
                    info["subdomains"].append(it["subdomain"])
                for k, v in (it.get("meta") or {}).items():
                    if v:
                        info["meta"].setdefault(k, v)
                        if k in ("DỰ ÁN", "PROJECT") and v not in info["projects"]:
                            info["projects"].append(v)
            for root, info in roots.items():
                gid = _upsert_group(
                    conn, root, root, info["subdomains"],
                    info["projects"] or ["Imported"], info["meta"],
                    workspace_id,
                )
                groups[root] = {"id": gid, "rootDomain": root, "subdomains": list(info["subdomains"])}
                stats["groups"] += 1
                _log(job, f"group '{root}' sẵn sàng ({len(info['subdomains'])} sub)")
        _set(job, f"Đã nhận diện {stats['groups']} domain gốc", 10)

    # ---- Giai đoạn 1: dò subdomain ----
    if cfg.get("discoverSubs") and groups:
        for root, grp in groups.items():
            _set(job, f"subfinder: {root}...", 10 + int(25 * (list(groups).index(root) + 1) / len(groups)))
            try:
                subs, engine, note = asyncio_run_discover(root, "subfinder")
                subs_set = set(grp["subdomains"])
                new_subs = [s for s in sorted(subs) if s not in subs_set]
                if new_subs:
                    stats["subsFound"] += len(new_subs)
                    grp["subdomains"] = grp["subdomains"] + new_subs
                    with db.get_conn() as conn:
                        conn.execute(
                            "UPDATE asset_groups SET subdomains_json=? WHERE id=?",
                            (db.dumps(grp["subdomains"]), grp["id"]),
                        )
                _log(job, f"subfinder {root}: +{len(new_subs)} sub mới ({engine})")
            except Exception as exc:
                stats["errors"] += 1
                _log(job, f"subfinder {root} THẤT BẠI: {exc}")
        _set(job, f"Dò sub xong (+{stats['subsFound']} sub)", 35)

    # ---- Giai đoạn 2: quét tech ----
    if cfg.get("techScan"):
        done = 0
        for it in items:
            url = it.get("normalizedUrl")
            if not url:
                continue
            done += 1
            _set(job, f"Quét tech: {url}", 35 + int(50 * done / len(items)))
            grp = groups.get(it.get("rootDomain") or "") if template_mode else None
            try:
                result = scanner.scan_target(
                    url,
                    timeout_sec=timeout_sec,
                    tech_detect=True,
                    follow_redirects=True,
                    asset_group_id=grp["id"] if grp else None,
                    use_nuclei=bool(cfg.get("nuclei")),
                )
                if it.get("meta"):
                    result["meta"] = it["meta"]
                if workspace_id:
                    result["workspaceId"] = workspace_id
                with db.get_conn() as conn:
                    inventory.upsert_asset(conn, result)
                    cve_engine.run_agent(conn)
                stats["techOk"] += 1
                _log(job, f"quét {url} -> {result['statusCode']} | {len(result['technologies'])} techs")
            except Exception as exc:
                stats["errors"] += 1
                _log(job, f"quét {url} LỖI: {exc}")

    # ---- Giai đoạn 3: httpx dò port ----
    if cfg.get("portScan") and groups:
        for root, grp in groups.items():
            if not grp["subdomains"]:
                continue
            _set(job, f"httpx: dò 79 web port trên {root}...", 85 + int(12 * (list(groups).index(root) + 1) / len(groups)))
            try:
                entries = asyncio_run_probe(grp["subdomains"])
                with db.get_conn() as conn:
                    for entry in entries:
                        result = httpx_engine.build_scan_result(entry, grp["id"])
                        if not result:
                            continue
                        inventory.upsert_asset(conn, result)
                        stats["portServices"] += 1
                        _log(job, f"httpx tìm thấy {result['url']} [{result['statusCode']}]")
                    cve_engine.run_agent(conn)
            except Exception as exc:
                stats["errors"] += 1
                _log(job, f"httpx {root} LỖI: {exc}")

    job["stats"] = stats
    job["progress"] = 100
    job["status"] = "done"
    job["phase"] = "Hoàn tất"
    summary = f"{stats['groups']} group • subfinder +{stats['subsFound']} sub • quét tech {stats['techOk']}/{stats['techTotal']} • httpx +{stats['portServices']} service"
    if stats["errors"]:
        summary += f" • {stats['errors']} lỗi"
    job["summary"] = summary
    _log(job, f"HOÀN TẤT: {summary}")
    log.info("[import %s] done: %s", job_id, summary)


# subprocess async helpers dùng trong thread (sync wrapper)
def asyncio_run_discover(root: str, engine: str):
    return asyncio.run(discovery.discover(root, engine))


def asyncio_run_probe(hosts: list[str]):
    return asyncio.run(httpx_engine.probe_hosts(hosts))


def start_group_scan(group_id: str, subdomains: list[str], cfg: dict,
                     timeout_sec: int, workspace_id: str | None = None) -> str:
    """Job quét tech song song cho toàn bộ subdomain của 1 group (chạy nền)."""
    job_id = f"gscan-{uuid.uuid4().hex[:10]}"
    job = {
        "id": job_id,
        "status": "queued",
        "phase": "Trong hàng đợi...",
        "progress": 0,
        "log": [],
        "stats": {"total": len(subdomains), "ok": 0, "errors": 0},
        "summary": None,
        "error": None,
        "createdAt": _now(),
    }
    with _lock:
        _jobs[job_id] = job
        if len(_jobs) > 20:
            for old in sorted(_jobs, key=lambda k: _jobs[k]["createdAt"])[: len(_jobs) - 20]:
                if _jobs[old]["status"] in ("done", "error"):
                    _jobs.pop(old)
    threading.Thread(
        target=_run_group_scan,
        args=(job_id, group_id, subdomains, cfg, timeout_sec, workspace_id),
        daemon=True,
    ).start()
    return job_id


def _run_group_scan(job_id: str, group_id: str, subdomains: list[str], cfg: dict,
                    timeout_sec: int, workspace_id: str | None) -> None:
    with _lock:
        job = _jobs[job_id]
    job["status"] = "running"

    from concurrent.futures import ThreadPoolExecutor

    results: list[dict] = []
    lock_results = threading.Lock()
    done_count = [0]

    def scan_one(sub: str) -> None:
        url = sub if sub.startswith("http") else f"https://{sub}"
        try:
            r = scanner.scan_target(
                url, timeout_sec=timeout_sec, tech_detect=True, follow_redirects=True,
                asset_group_id=group_id, use_nuclei=bool(cfg.get("nuclei")),
            )
            if workspace_id:
                r["workspaceId"] = workspace_id
            with lock_results:
                results.append(r)
        except Exception as exc:
            log.warning("group scan %s lỗi: %s", url, exc)
        with lock_results:
            done_count[0] += 1
            _set(job, f"Đang quét {sub} ({done_count[0]}/{len(subdomains)})",
                 int(95 * done_count[0] / max(len(subdomains), 1)))

    # song song 10 luồng (nuclei tự giới hạn bên trong nếu bật)
    max_workers = 4 if cfg.get("nuclei") else 10
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(scan_one, subdomains))

    with db.get_conn() as conn:
        for r in results:
            inventory.upsert_asset(conn, r)
        cve_engine.run_agent(conn)

    ok_count = sum(1 for r in results if r.get("statusCode", 0) > 0)
    job["stats"] = {"total": len(subdomains), "ok": ok_count, "errors": len(subdomains) - ok_count}
    job["progress"] = 100
    job["status"] = "done"
    job["phase"] = "Hoàn tất"
    job["summary"] = f"Quét xong {len(subdomains)} sub của group: {ok_count} live, {len(subdomains) - ok_count} không phản hồi"
    _log(job, f"HOÀN TẤT: {ok_count}/{len(subdomains)} live")
    log.info("[group-scan %s] done: %d/%d live", job_id[:12], ok_count, len(subdomains))
