"""
CVE Agent Engine: so khớp CVE (bot đẩy lên) với tech đã phát hiện trên từng asset.
- Khi bot đẩy CVE (POST /api/cve/push): chạy so khớp ngay, sinh alert mới.
- Khi quét xong asset (scan): chạy so khớp asset đó với toàn bộ CVE đã biết.
- POST /api/cve/agent/run: quét lại toàn bộ.

Ngữ cảnh giữ nguyên trạng thái triage: alert đã tồn tại (theo cặp cve_id +
asset_id) giữ nguyên status; alert không còn khớp (VD: đã vá, rescan phiên bản
mới) sẽ bị gỡ khỏi danh sách cảnh báo đang mở.
"""
import logging
from datetime import datetime, timezone

from . import db

log = logging.getLogger("cve-agent")
from .versioning import is_version_affected, software_matches, version_from_server_header


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def match_cve_against_asset(cve: dict, asset: dict) -> dict | None:
    """Trả về dict alert nếu CVE khớp asset, ngược lại None."""
    cve_id = cve["cveId"]
    rule = cve["affectedVersions"]
    software = cve["software"]

    # 1) So khớp qua Server header (VD: "Apache/2.4.52 (Ubuntu)")
    web_server = asset.get("webServer")
    if web_server:
        if software_matches(web_server, software):
            version = version_from_server_header(web_server)
            if version and is_version_affected(version, rule):
                return {
                    "cveId": cve_id,
                    "cveTitle": cve.get("summary") or f"CVE {cve_id} ảnh hưởng {software} ({rule})",
                    "software": software,
                    "affectedVersions": rule,
                    "severity": cve["severity"],
                    "cvssScore": cve.get("cvssScore"),
                    "matchedAssetId": asset["id"],
                    "assetHost": asset.get("host") or asset.get("url"),
                    "assetUrl": asset["url"],
                    "detectedVersion": f"{software} {version} (via Server Header)",
                    "remediation": cve.get("remediation")
                    or f"Nâng cấp {software} lên phiên bản mới không nằm trong dải bị ảnh hưởng ({rule}).",
                    "detectedAt": _now(),
                    "status": "active",
                }

    # 2) So khớp qua danh sách công nghệ đã fingerprint (kèm version)
    for tech in asset.get("technologies") or []:
        if not software_matches(tech.get("name", ""), software):
            continue
        version = tech.get("version") or ""
        if version and is_version_affected(version, rule):
            return {
                "cveId": cve_id,
                "cveTitle": cve.get("summary") or f"CVE {cve_id} ảnh hưởng {software} ({rule})",
                "software": software,
                "affectedVersions": rule,
                "severity": cve["severity"],
                "cvssScore": cve.get("cvssScore"),
                "matchedAssetId": asset["id"],
                "assetHost": asset.get("host") or asset.get("url"),
                "assetUrl": asset["url"],
                "detectedVersion": f"{tech['name']} {version}",
                "remediation": cve.get("remediation")
                or f"Nâng cấp {tech['name']} lên phiên bản an toàn hơn ({rule}).",
                "detectedAt": _now(),
                "status": "active",
            }
    return None


def run_agent(conn) -> list[dict]:
    """
    Chạy toàn bộ: mọi CVE x mọi asset. Upsert alert (giữ status cũ),
    xóa alert không còn khớp. Trả về danh sách alert hiện hành.
    """
    cves = [db.cve_row_to_dict(r) for r in conn.execute("SELECT * FROM cves").fetchall()]
    assets = [
        db.asset_row_to_dict(r)
        for r in conn.execute("SELECT * FROM assets").fetchall()
    ]

    existing = {
        (row["cve_id"], row["matched_asset_id"]): row
        for row in conn.execute("SELECT * FROM cve_alerts").fetchall()
    }
    fresh: dict[tuple[str, str], dict] = {}
    new_count = 0

    for cve in cves:
        for asset in assets:
            alert = match_cve_against_asset(cve, asset)
            if alert:
                if (alert["cveId"], alert["matchedAssetId"]) not in existing:
                    new_count += 1
                fresh[(alert["cveId"], alert["matchedAssetId"])] = alert

    conn.execute("DELETE FROM cve_alerts")
    rows = []
    for (cve_id, asset_id), alert in fresh.items():
        old = existing.get((cve_id, asset_id))
        if old:  # giữ trạng thái triage + thời điểm phát hiện ban đầu
            alert["status"] = old["status"]
            alert["detectedAt"] = old["detected_at"]
        alert["id"] = f"alert-{cve_id}-{asset_id}"
        rows.append(alert)
        conn.execute(
            """INSERT INTO cve_alerts (id, cve_id, cve_title, software, affected_versions,
               severity, cvss_score, matched_asset_id, asset_host, asset_url,
               detected_version, remediation, detected_at, status)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                alert["id"], alert["cveId"], alert["cveTitle"], alert["software"],
                alert["affectedVersions"], alert["severity"], alert["cvssScore"],
                alert["matchedAssetId"], alert["assetHost"], alert["assetUrl"],
                alert["detectedVersion"], alert["remediation"],
                alert["detectedAt"], alert["status"],
            ),
        )
    log.info("cve-agent: assets=%d cves=%d -> alerts=%d (mới: %d)", len(assets), len(cves), len(rows), new_count)
    return rows


def push_cve(conn, payload: dict) -> dict:
    """Upsert CVE do bot đẩy lên + chạy agent. Trả về response payload."""
    cve_id = payload["cveId"].strip().upper()
    software = payload["software"].strip()
    affected = payload["affectedVersions"].strip()
    severity = (payload.get("severity") or "").strip().upper()
    if severity not in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        score = float(payload.get("cvssScore") or 0)
        severity = "CRITICAL" if score >= 9 else "HIGH" if score >= 7 else "MEDIUM" if score >= 4 else "LOW"

    cve = {
        "id": db.new_id("cve"),
        "cveId": cve_id,
        "software": software,
        "affectedVersions": affected,
        "severity": severity,
        "cvssScore": float(payload["cvssScore"]) if payload.get("cvssScore") is not None else None,
        "summary": payload.get("summary") or f"Cảnh báo lỗ hổng bảo mật cho {software} ({affected})",
        "remediation": payload.get("remediation") or f"Khuyến nghị cập nhật {software} lên phiên bản mới hơn.",
        "source": payload.get("source") or "Bot Webhook",
        "pushedAt": _now(),
    }

    conn.execute(
        """INSERT INTO cves (id, cve_id, software, affected_versions, severity, cvss_score,
           summary, remediation, source, pushed_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(cve_id) DO UPDATE SET
             software=excluded.software, affected_versions=excluded.affected_versions,
             severity=excluded.severity, cvss_score=excluded.cvss_score,
             summary=excluded.summary, remediation=excluded.remediation,
             source=excluded.source, pushed_at=excluded.pushed_at""",
        (
            cve["id"], cve["cveId"], cve["software"], cve["affectedVersions"],
            cve["severity"], cve["cvssScore"], cve["summary"], cve["remediation"],
            cve["source"], cve["pushedAt"],
        ),
    )

    alerts = run_agent(conn)
    matched = [a for a in alerts if a["cveId"] == cve_id]
    return {
        "success": True,
        "message": f"Đã nạp thành công mã CVE: {cve_id}",
        "cve": cve,
        "matchedCount": len(matched),
        "matchedAssets": [
            {"host": a["assetHost"], "url": a["assetUrl"],
             "detectedVersion": a["detectedVersion"], "severity": a["severity"]}
            for a in matched
        ],
        "alertsCreated": matched,
    }
