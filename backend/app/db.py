"""SQLite storage — WAL mode, mỗi thao tác mở connection ngắn (an toàn với threadpool)."""
import json
import os
import sqlite3
from datetime import datetime, timezone
import uuid
from contextlib import contextmanager

from . import config


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(config.DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=10000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  final_url TEXT, host TEXT, port INTEGER, scheme TEXT,
  status_code INTEGER DEFAULT 0, status_text TEXT, title TEXT,
  web_server TEXT, content_length INTEGER, content_type TEXT,
  response_time_ms INTEGER, ip TEXT, asn TEXT,
  ssl_json TEXT, technologies_json TEXT, headers_json TEXT, chain_json TEXT,
  labels_json TEXT, asset_group_id TEXT, workspace_id TEXT, error TEXT,
  timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS asset_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, root_domain TEXT NOT NULL, description TEXT,
  subdomains_json TEXT, tags_json TEXT, workspace_id TEXT,
  created_at TEXT NOT NULL, last_scanned TEXT
);
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, cron_expression TEXT NOT NULL, schedule_human TEXT,
  target_type TEXT DEFAULT 'subdomain-list', target_group_id TEXT,
  target_urls_json TEXT NOT NULL, options_json TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run TEXT, last_run_status TEXT, last_discovered_count INTEGER,
  next_run TEXT, total_runs INTEGER DEFAULT 0, notify_on_new_assets INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cves (
  id TEXT PRIMARY KEY,
  cve_id TEXT UNIQUE NOT NULL,
  software TEXT NOT NULL, affected_versions TEXT NOT NULL,
  severity TEXT NOT NULL, cvss_score REAL, summary TEXT,
  remediation TEXT, source TEXT, pushed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cve_alerts (
  id TEXT PRIMARY KEY,
  cve_id TEXT NOT NULL, cve_title TEXT, software TEXT, affected_versions TEXT,
  severity TEXT NOT NULL, cvss_score REAL,
  matched_asset_id TEXT NOT NULL, asset_host TEXT, asset_url TEXT,
  detected_version TEXT, remediation TEXT,
  detected_at TEXT NOT NULL, status TEXT DEFAULT 'active',
  UNIQUE(cve_id, matched_asset_id)
);
"""


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        # Migration cho DB tạo từ phiên bản cũ: thêm cột thiếu
        _ensure_column(conn, "assets", "meta_json", "TEXT")
        _ensure_column(conn, "assets", "workspace_id", "TEXT")
        _ensure_column(conn, "asset_groups", "meta_json", "TEXT")
        _ensure_column(conn, "asset_groups", "workspace_id", "TEXT")
        _ensure_workspace(conn)


def _ensure_workspace(conn) -> str:
    """Đảm bảo có Default Workspace; gán asset/group chưa có workspace về đó."""
    row = conn.execute("SELECT id FROM workspaces WHERE is_default = 1").fetchone()
    if row:
        ws_id = row["id"]
    else:
        ws_id = "ws-default"
        conn.execute(
            "INSERT OR IGNORE INTO workspaces (id, name, is_default, created_at) VALUES (?,?,1,?)",
            (ws_id, "Default Workspace", datetime.now(timezone.utc).isoformat()),
        )
    # Backfill LUÔN (không chỉ khi vừa tạo): DB cũ có thể còn asset/group NULL
    conn.execute("UPDATE assets SET workspace_id=? WHERE workspace_id IS NULL", (ws_id,))
    conn.execute("UPDATE asset_groups SET workspace_id=? WHERE workspace_id IS NULL", (ws_id,))
    _backfill_asset_group_links(conn)
    _backfill_discovered_assets(conn)
    return ws_id


def _backfill_asset_group_links(conn) -> None:
    """Gán asset_group_id cho asset cũ chưa có group: match host với root_domain
    của group (host == root hoặc host đuôi .root), ưu tiên group cùng workspace.
    Idempotent — chỉ touches asset có asset_group_id IS NULL."""
    groups = conn.execute(
        "SELECT id, root_domain, workspace_id FROM asset_groups ORDER BY created_at ASC"
    ).fetchall()
    if not groups:
        return
    assets = conn.execute(
        "SELECT id, host, workspace_id FROM assets WHERE asset_group_id IS NULL AND host IS NOT NULL"
    ).fetchall()
    for a in assets:
        host = (a["host"] or "").lower().strip()
        if not host:
            continue
        match_same_ws = None
        match_any = None
        for g in groups:
            root = (g["root_domain"] or "").lower().strip()
            if not root:
                continue
            if host == root or host.endswith("." + root):
                match_any = match_any or g
                if g["workspace_id"] and g["workspace_id"] == a["workspace_id"]:
                    match_same_ws = match_same_ws or g
                    break
        chosen = match_same_ws or match_any
        if chosen:
            conn.execute("UPDATE assets SET asset_group_id=? WHERE id=?", (chosen["id"], a["id"]))


def _backfill_discovered_assets(conn) -> int:
    """Tạo asset 'chưa quét' cho subdomain đã discover nhưng chưa có asset row,
    để số rows trong group khớp con số services trên card. Idempotent."""
    import re as _re

    groups = conn.execute(
        "SELECT id, root_domain, workspace_id, subdomains_json FROM asset_groups"
    ).fetchall()
    if not groups:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    host_re = _re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
    created = 0
    for g in groups:
        subs = loads(g["subdomains_json"], []) or []
        candidates = list(dict.fromkeys([*subs, g["root_domain"]]))
        for sub in candidates:
            host = (str(sub) if sub is not None else "").strip().lower().rstrip(".")
            if not host or "." not in host or not host_re.match(host):
                continue
            if conn.execute("SELECT 1 FROM assets WHERE host = ? LIMIT 1", (host,)).fetchone():
                continue
            conn.execute(
                """INSERT OR IGNORE INTO assets
                   (id, url, host, scheme, status_code, labels_json,
                    asset_group_id, workspace_id, timestamp)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    new_id("asset"), f"https://{host}", host, "https", 0,
                    dumps(["discovered"]), g["id"], g["workspace_id"], now,
                ),
            )
            created += 1
    return created


def _ensure_column(conn, table: str, column: str, decl: str) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads(raw, default=None):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


# ---- Serializers: row DB -> dict camelCase khớp ScanResult của frontend ----

def asset_row_to_dict(row: sqlite3.Row) -> dict:
    d = {
        "id": row["id"],
        "url": row["url"],
        "host": row["host"],
        "port": row["port"],
        "scheme": row["scheme"],
        "statusCode": row["status_code"],
        "statusText": row["status_text"],
        "title": row["title"],
        "webServer": row["web_server"],
        "contentLength": row["content_length"],
        "contentType": row["content_type"],
        "responseTimeMs": row["response_time_ms"],
        "ip": row["ip"],
        "asn": row["asn"],
        "technologies": loads(row["technologies_json"], []),
        "headers": loads(row["headers_json"], {}),
        "labels": loads(row["labels_json"], []),
        "timestamp": row["timestamp"],
    }
    for json_col, key in (("ssl_json", "ssl"), ("chain_json", "chain"), ("meta_json", "meta")):
        value = loads(row[json_col])
        if value is not None:
            d[key] = value
    if row["final_url"]:
        d["finalUrl"] = row["final_url"]
    if row["asset_group_id"]:
        d["assetGroupId"] = row["asset_group_id"]
    if row["workspace_id"]:
        d["workspaceId"] = row["workspace_id"]
    if row["error"]:
        d["error"] = row["error"]
    return d


def cve_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "cveId": row["cve_id"],
        "software": row["software"],
        "affectedVersions": row["affected_versions"],
        "severity": row["severity"],
        "cvssScore": row["cvss_score"],
        "summary": row["summary"],
        "remediation": row["remediation"],
        "source": row["source"],
        "pushedAt": row["pushed_at"],
    }


def alert_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "cveId": row["cve_id"],
        "cveTitle": row["cve_title"],
        "software": row["software"],
        "affectedVersions": row["affected_versions"],
        "severity": row["severity"],
        "cvssScore": row["cvss_score"],
        "matchedAssetId": row["matched_asset_id"],
        "assetHost": row["asset_host"],
        "assetUrl": row["asset_url"],
        "detectedVersion": row["detected_version"],
        "remediation": row["remediation"],
        "detectedAt": row["detected_at"],
        "status": row["status"],
    }


def group_row_to_dict(row: sqlite3.Row) -> dict:
    d = {
        "id": row["id"],
        "name": row["name"],
        "rootDomain": row["root_domain"],
        "description": row["description"],
        "assetCount": len(loads(row["subdomains_json"], [])),
        "subdomains": loads(row["subdomains_json"], []),
        "createdAt": row["created_at"],
        "lastScanned": row["last_scanned"],
        "tags": loads(row["tags_json"], []),
        "workspaceId": row["workspace_id"],
    }
    meta = loads(row["meta_json"])
    if meta is not None:
        d["meta"] = meta
    return d


def job_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "cronExpression": row["cron_expression"],
        "scheduleHuman": row["schedule_human"],
        "targetType": row["target_type"],
        "targetGroupId": row["target_group_id"],
        "targetUrls": loads(row["target_urls_json"], []),
        "options": loads(row["options_json"], {}),
        "enabled": bool(row["enabled"]),
        "lastRun": row["last_run"],
        "lastRunStatus": row["last_run_status"],
        "lastDiscoveredCount": row["last_discovered_count"],
        "nextRun": row["next_run"],
        "totalRuns": row["total_runs"],
        "notifyOnNewAssets": bool(row["notify_on_new_assets"]),
    }
