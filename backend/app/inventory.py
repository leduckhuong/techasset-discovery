"""Lưu trữ / cập nhật asset sau khi quét. Mỗi lần upsert đều chạy lại CVE agent
để phát hiện cảnh báo mới ngay lập tức (tech mới có thể dính CVE đã biết)."""
from . import db

UPSERT_SQL = """
INSERT INTO assets (id, url, final_url, host, port, scheme, status_code, status_text,
  title, web_server, content_length, content_type, response_time_ms, ip, asn,
  ssl_json, technologies_json, headers_json, chain_json, labels_json,
  asset_group_id, workspace_id, meta_json, error, timestamp)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(url) DO UPDATE SET
  final_url=excluded.final_url, host=excluded.host, port=excluded.port,
  scheme=excluded.scheme, status_code=excluded.status_code,
  status_text=excluded.status_text, title=excluded.title,
  web_server=excluded.web_server, content_length=excluded.content_length,
  content_type=excluded.content_type, response_time_ms=excluded.response_time_ms,
  ip=excluded.ip, asn=excluded.asn, ssl_json=excluded.ssl_json,
  technologies_json=excluded.technologies_json, headers_json=excluded.headers_json,
  chain_json=excluded.chain_json, labels_json=excluded.labels_json,
  asset_group_id=COALESCE(excluded.asset_group_id, assets.asset_group_id),
  workspace_id=COALESCE(excluded.workspace_id, assets.workspace_id),
  meta_json=COALESCE(excluded.meta_json, assets.meta_json),
  error=excluded.error, timestamp=excluded.timestamp
"""


def upsert_asset(conn, result: dict) -> str:
    """Lưu ScanResult vào DB. Trả về id của asset."""
    row = conn.execute("SELECT id FROM assets WHERE url = ?", (result["url"],)).fetchone()
    asset_id = row["id"] if row else result.get("id") or db.new_id("asset")
    conn.execute(
        UPSERT_SQL,
        (
            asset_id, result["url"], result.get("finalUrl"), result.get("host"),
            result.get("port"), result.get("scheme"), result.get("statusCode", 0),
            result.get("statusText"), result.get("title"), result.get("webServer"),
            result.get("contentLength"), result.get("contentType"),
            result.get("responseTimeMs"), result.get("ip"), result.get("asn"),
            db.dumps(result["ssl"]) if result.get("ssl") else None,
            db.dumps(result.get("technologies") or []),
            db.dumps(result.get("headers") or {}),
            db.dumps(result["chain"]) if result.get("chain") else None,
            db.dumps(result.get("labels") or []),
            result.get("assetGroupId"),
            result.get("workspaceId"),
            db.dumps(result["meta"]) if result.get("meta") else None,
            result.get("error"), result.get("timestamp"),
        ),
    )
    return asset_id
