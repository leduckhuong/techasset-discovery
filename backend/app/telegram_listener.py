"""
Telegram listener — "đánh thức AGENT" khi nhóm có tin nhắn CVE mới.

Flow: getUpdates (long polling) -> tin chứa CVE-ID -> AI (deepseek) parse
cấu trúc (software/affectedVersions/severity/summary) -> rà soát TOÀN BỘ
assets trong inventory (tech nào dính, version nào trong range) -> đẩy CVE +
alert vào dashboard -> báo ngược lại nhóm Telegram.
"""
import logging
import re
import threading
import time

import httpx

from . import ai, config, db
from .versioning import is_version_affected, software_matches

log = logging.getLogger("tg-listener")

CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.I)

_running = False
_offset = 0
_thread = None


def start() -> bool:
    """Khởi động listener trong daemon thread. Trả về True nếu start được."""
    global _running, _thread
    if _running:
        return True
    if not (config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID):
        log.info("telegram listener tắt: chưa cấu hình token/chat")
        return False
    _running = True
    _thread = threading.Thread(target=_loop, daemon=True, name="tg-listener")
    _thread.start()
    log.info("telegram listener đã khởi động (chat %s)", config.TELEGRAM_CHAT_ID)
    return True


def stop() -> None:
    global _running
    _running = False


def handle_text(text: str, chat_id: str | None = None) -> dict:
    """
    Xử lý 1 tin nhắn CVE (dùng cho getUpdates + /api/telegram/simulate).
    Trả về thống kê pipeline.
    """
    result = {"cveId": None, "software": None, "affectedVersions": None,
              "totalAssets": 0, "affected": [], "alertsCreated": 0}

    cve_ids = list(dict.fromkeys(CVE_RE.findall(text or "")))
    if not cve_ids:
        return result

    # ---- Đánh thức AGENT: parse tin bằng LLM ----
    import asyncio
    extracted = asyncio.run(ai.extract_cve_from_text(text))

    for cve_id in cve_ids:
        info = dict(extracted)
        info["cveId"] = cve_id.upper()
        result["cveId"] = info["cveId"]
        result["software"] = info.get("software")
        result["affectedVersions"] = info.get("affectedVersions")

        payload = {
            "cveId": info["cveId"],
            "software": info.get("software") or info.get("cveId"),
            "affectedVersions": info.get("affectedVersions") or "*",
            "severity": info.get("severity") or "HIGH",
            "cvssScore": info.get("cvssScore"),
            "summary": info.get("summary") or text.strip()[:400],
            "source": "Telegram AGI (auto)",
        }

        # ---- Rà soát TOÀN BỘ assets: tech nào dính CVE này ----
        with db.get_conn() as conn:
            assets = [
                db.asset_row_to_dict(r)
                for r in conn.execute("SELECT * FROM assets").fetchall()
            ]
            total_assets = len(assets)

            affected = []
            for a in assets:
                techs = a.get("technologies") or []
                software = info.get("software") or ""

                uses_tech = False
                version_hit = None
                if software:
                    for t in techs:
                        if software_matches(t.get("name", ""), software):
                            uses_tech = True
                            ver = t.get("version")
                            if ver and info.get("affectedVersions") not in (None, "", "*"):
                                try:
                                    if is_version_affected(ver, info["affectedVersions"]):
                                        version_hit = ver
                                except Exception:
                                    version_hit = ver
                            elif ver and not version_hit:
                                version_hit = ver
                if uses_tech:
                    if version_hit:
                        affected.append({
                            "host": a.get("host"), "url": a.get("url"),
                            "detail": f"{software} {version_hit}",
                        })
                    else:
                        affected.append({
                            "host": a.get("host"), "url": a.get("url"),
                            "detail": f"dùng {software}",
                        })

            # ---- Đẩy CVE vào hệ thống (upsert + agent sinh alert) ----
            cve_engine_push(conn, payload)
            alert_rows = conn.execute(
                "SELECT asset_url, asset_host, detected_version FROM cve_alerts WHERE cve_id = ? AND status != 'resolved'",
                (info["cveId"],),
            ).fetchall()
            for r in alert_rows:
                affected.append({
                    "host": r["asset_host"], "url": r["asset_url"],
                    "detail": r["detected_version"] or software or "",
                })
            new_count = len(alert_rows)

        result["totalAssets"] = total_assets
        result["affected"] = affected
        result["alertsCreated"] = new_count

        # ---- Báo ngược lại nhóm Telegram ----
        send_report(info, total_assets, affected, new_count)

    return result


def cve_engine_push(conn, payload):
    from . import cve_engine
    return cve_engine.push_cve(conn, payload)


def send_report(info: dict, total_assets: int, affected: list, new_count: int) -> None:
    from . import telegram

    software = info.get("software") or info.get("cveId")
    head = f"🧠 <b>[AGI] Rà soát hoàn tất — {info.get('cveId')}</b>"
    lines = [
        head,
        f"📄 {info.get('summary', '')}",
        f"🔎 Đã rà <b>{total_assets}</b> asset trong inventory:",
    ]
    if affected:
        lines.append(f"⚠️ <b>{len(affected)} asset bị ảnh hưởng</b> ({software}):")
        for a in affected[:10]:
            lines.append(f"  • <a href=\"{a.get('url')}\">{a.get('host')}</a> — {a['detail']}")
        if len(affected) > 10:
            lines.append(f"  ... và {len(affected) - 10} asset khác")
        lines.append("🔔 Đã tạo alert trong dashboard — ưu tiên vá ngay.")
    else:
        lines.append("✅ Không có asset nào trong inventory bị ảnh hưởng.")
    if new_count:
        lines.append(f"🆕 {new_count} alert mới đã tạo.")

    ok, detail = telegram.send_message("\n".join(lines))
    if not ok:
        log.warning("gửi report thất bại: %s", detail)


def _loop() -> None:
    global _offset
    api = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"
    # id của bot mình — bỏ qua tin do bot tự gửi (tin từ feed bot khác vẫn xử lý)
    own_bot_id = None
    try:
        me = httpx.get(f"{api}/getMe", timeout=15).json()
        own_bot_id = (me.get("result") or {}).get("id")
        log.info("bot id: %s", own_bot_id)
    except Exception as exc:
        log.warning("getMe lỗi: %s", exc)
    log.info("long-polling getUpdates khởi động (đọc nhóm feed %s)", config.TELEGRAM_CHAT_ID)
    while _running:
        try:
            resp = httpx.get(
                f"{api}/getUpdates",
                params={"timeout": 25, "offset": _offset, "allowed_updates": '["message","channel_post"]'},
                timeout=35,
            )
            if resp.status_code == 409:
                log.warning("getUpdates conflict — instance khác đang chạy, thử lại sau 30s")
                time.sleep(30)
                continue
            data = resp.json()
            for upd in data.get("result", []):
                _offset = max(_offset, upd.get("update_id", 0) + 1)
                msg = upd.get("message") or upd.get("channel_post") or {}
                chat_id = str((msg.get("chat") or {}).get("id", ""))
                if chat_id != str(config.TELEGRAM_CHAT_ID):
                    continue
                sender_id = (msg.get("from") or {}).get("id")
                if own_bot_id and sender_id == own_bot_id:
                    continue
                text = msg.get("text") or msg.get("caption") or ""
                if not text:
                    continue
                if "CVE-" not in text.upper():
                    continue
                log.info("nhận tin CVE từ nhóm, kích hoạt AGI pipeline...")
                try:
                    handle_text(text, chat_id)
                except Exception as exc:
                    log.exception("xử lý tin CVE lỗi: %s", exc)
        except httpx.HTTPError as exc:
            log.warning("getUpdates lỗi mạng: %s — thử lại sau 10s", exc)
            time.sleep(10)
        except Exception as exc:
            log.exception("listener lỗi không xác định: %s", exc)
            time.sleep(10)



