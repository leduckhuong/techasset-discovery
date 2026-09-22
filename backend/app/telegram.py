"""
Telegram notifier: đẩy CVE alert vào nhóm theo mẫu tin nhắn.
Cấu hình: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (backend/.env)
"""
import logging
import time

import httpx

from . import config

log = logging.getLogger("telegram")


def configured() -> bool:
    return bool(config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID)


def send_message(text: str, chat_id: str | None = None) -> tuple[bool, str]:
    """Gửi tin nhắn HTML vào nhóm. Trả về (ok, detail)."""
    if not configured():
        return False, "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID chưa cấu hình"
    url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/sendMessage"
    last_err = ""
    for attempt in range(2):  # mạng VN thỉnh thoảng fail — thử 2 lần
        try:
            resp = httpx.post(
                url,
                json={
                    "chat_id": chat_id or config.TELEGRAM_CHAT_ID,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
                timeout=20,
            )
            data = resp.json()
            if resp.status_code == 200 and data.get("ok"):
                return True, "sent"
            last_err = f"Telegram API: {data.get('description', resp.status_code)}"
        except Exception as exc:
            last_err = str(exc)
        if attempt == 0:
            time.sleep(1.5)
    log.warning("telegram send thất bại: %s", last_err)
    return False, last_err


def format_cve_alert(alert: dict) -> str:
    """Format alert theo mẫu: CVE / Title / Description / Link (+ chi tiết asset)."""
    cve_id = alert.get("cveId", "")
    title = alert.get("cveTitle") or f"Lỗ hổng {alert.get('software', '')}"
    desc = alert.get("cveTitle") or title
    severity = alert.get("severity", "")
    score = alert.get("cvssScore")
    link = f"https://www.cve.org/CVERecord?id={cve_id}"
    remediation = alert.get("remediation", "")
    icon = "🔴" if severity == "CRITICAL" else "🟠" if severity == "HIGH" else "🟡" if severity == "MEDIUM" else "🟢"

    parts = [f"🚨 CVE: <b>{cve_id}</b>", "", f"<b>Title:</b> {title}"]
    meta = []
    if severity:
        meta.append(f"{icon} {severity}")
    if score:
        meta.append(f"CVSS {score}")
    if meta:
        parts.append("<b>Mức độ:</b> " + " | ".join(meta))
    asset_line = f"🌐 <b>Asset:</b> {alert.get('assetUrl') or alert.get('assetHost', '')}"
    if alert.get("detectedVersion"):
        asset_line += f" — phát hiện {alert['detectedVersion']}"
    parts.append(asset_line)
    parts.append("")
    parts.append(f"<b>Description:</b> {desc}")
    if remediation:
        parts.append("")
        parts.append(f"<b>Remediation:</b> {remediation}")
    parts.append("")
    parts.append(f"Link: {link}")
    return "\n".join(parts)


def format_and_send(alert: dict) -> bool:
    ok, detail = send_message(format_cve_alert(alert))
    if not ok:
        log.warning("gửi alert %s thất bại: %s", alert.get("cveId"), detail)
    return ok
