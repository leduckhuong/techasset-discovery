"""
Telegram listener — "đánh thức AGENT" khi nhóm feed có tin CVE mới.

Kiến trúc chống DoS:
  - Poll loop CHỈ nhận tin + xếp vào hàng đợi (nhanh, không block)
  - Worker tách rời xử lý từng CVE (AI parse -> rà assets -> push -> báo nhóm)
  - Gom trùng: cùng 1 CVE đang chờ/đang xử lý thì bỏ qua
  - Queue có giới hạn; quá tải thì bỏ và log (CVE upsert idempotent, an toàn)
  - CVE đã có trong DB -> bỏ qua hoàn toàn (không re-parse, không re-report)
"""
import asyncio
import json
import logging
import queue
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
_thread_poll = None
_threads_worker: list[threading.Thread] = []

_task_queue: "queue.Queue[tuple[str, str]]" = queue.Queue(maxsize=config.TELEGRAM_QUEUE_MAXSIZE)
_pending_lock = threading.Lock()
_pending: set[str] = set()  # cve_id đang chờ/xử lý — chống xử lý trùng

_stat = {"received": 0, "queued": 0, "processed": 0, "skipped": 0, "dropped": 0, "affected": 0}


def start() -> bool:
    """Khởi động poll thread + worker threads. Trả về True nếu start được."""
    global _running, _thread_poll
    if _running:
        return True
    if not (config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID):
        log.info("telegram listener tắt: chưa cấu hình token/chat")
        return False
    _running = True
    _thread_poll = threading.Thread(target=_poll_loop, daemon=True, name="tg-poll")
    _thread_poll.start()
    for i in range(config.TELEGRAM_QUEUE_WORKERS):
        threading.Thread(target=_worker, daemon=True, name=f"tg-worker-{i}").start()
    log.info(
        "telegram listener ON (feed %s) — %d workers, queue max %d",
        config.TELEGRAM_CHAT_ID, config.TELEGRAM_QUEUE_WORKERS, config.TELEGRAM_QUEUE_MAXSIZE,
    )
    return True


def stop() -> None:
    global _running
    _running = False


def status() -> dict:
    with _pending_lock:
        pending = len(_pending)
    return {
        "running": _running,
        "feedChatId": config.TELEGRAM_CHAT_ID,
        "reportChatId": config.TELEGRAM_REPORT_CHAT_ID or config.TELEGRAM_CHAT_ID,
        "queueSize": _task_queue.qsize(),
        "pending": pending,
        **_stat,
    }


def handle_text(text: str, chat_id: str | None = None) -> dict:
    """
    Nhận 1 tin nhắn (từ getUpdates hoặc /api/telegram/simulate).
    Chỉ XẾP HÀNG — xử lý do worker thực hiện. Trả về thống kê enqueue.
    """
    cve_ids = list(dict.fromkeys(CVE_RE.findall(text or "")))
    queued = 0
    for cve_id in cve_ids:
        with _pending_lock:
            if cve_id in _pending:
                continue
            try:
                _task_queue.put_nowait((cve_id.upper(), text))
                _pending.add(cve_id)
                queued += 1
                _stat["queued"] += 1
            except queue.Full:
                _stat["dropped"] += 1
                log.warning("hàng đợi đầy (%d) — bỏ tin %s", config.TELEGRAM_QUEUE_MAXSIZE, cve_id)
    if cve_ids and queued == 0:
        _stat["skipped"] += 1
    return {"cveIds": cve_ids, "queued": queued}


def _worker() -> None:
    while _running:
        try:
            cve_id, text = _task_queue.get(timeout=1)
        except queue.Empty:
            continue
        try:
            _process_cve(cve_id, text)
        except Exception:
            log.exception("xử lý CVE %s lỗi không xác định", cve_id)
        finally:
            with _pending_lock:
                _pending.discard(cve_id)
            _task_queue.task_done()
            _stat["processed"] += 1


def _process_cve(cve_id: str, text: str) -> None:
    # CVE đã có trong DB -> bỏ qua (không re-parse, không re-report)
    with db.get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM cves WHERE cve_id = ?", (cve_id,)).fetchone()
    if exists:
        log.info("%s đã có trong hệ thống — bỏ qua", cve_id)
        return

    # ---- Đánh thức AGENT: AI parse tin tự do ----
    info = asyncio.run(ai.extract_cve_from_text(text))
    info["cveId"] = cve_id
    software = info.get("software") or info.get("cveId")
    versions = info.get("affectedVersions") or "*"
    log.info("AGI parse: %s | %s %s | %s", cve_id, software, versions, info.get("severity"))


    # ---- Rà soát TOÀN BỘ assets: tech nào dính, version trong range không ----
    affected: list[dict] = []
    with db.get_conn() as conn:
        assets = [db.asset_row_to_dict(r) for r in conn.execute("SELECT * FROM assets").fetchall()]
        for a in assets:
            techs = a.get("technologies") or []
            uses = False
            ver_hit = None
            for t in techs:
                if software_matches(t.get("name", ""), software):
                    uses = True
                    ver = t.get("version")
                    if ver and versions != "*":
                        try:
                            if is_version_affected(ver, versions):
                                ver_hit = ver
                        except Exception:
                            ver_hit = ver
                    elif ver and not ver_hit:
                        ver_hit = ver
            if uses:
                affected.append({"asset": a, "ver": ver_hit or ""})

        # ---- Push CVE vào hệ thống (upsert + agent sinh alert) ----
        conn.execute(
            """INSERT INTO cves (id, cve_id, software, affected_versions, severity, cvss_score,
               summary, remediation, source, pushed_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                db.new_id("cve"), cve_id, software, versions,
                info.get("severity") or "HIGH", info.get("cvssScore"),
                info.get("summary") or text.strip()[:400],
                None, "Telegram AGI (auto)", _now_iso(),
            ),
        )
        from . import cve_engine
        cve_engine.run_agent(conn)

    # ---- Báo ngược lại nhóm Telegram ----
        sev = info.get("severity") or "HIGH"
    icon = "🔴" if sev == "CRITICAL" else "🟠" if sev == "HIGH" else "🟡"
    lines = [
        f"🧠 <b>[AGI] Rà soát hoàn tất — {cve_id}</b>",
        f"🎯 <b>{software}</b> {versions} — {icon} {sev}",
        f"🔎 Đã rà <b>{len(assets)}</b> asset trong inventory:",
    ]
    if affected:
        lines.append(f"⚠️ <b>{len(affected)} asset bị ảnh hưởng:</b>")
        for a in affected[:10]:
            url = a["asset"].get("url") or ""
            host = a["asset"].get("host") or ""
            ver = a["ver"]
            lines.append(f'  • <a href="{url}">{host}</a>' + (f" — {ver}" if ver else ""))
        if len(affected) > 10:
            lines.append(f"  ... và {len(affected) - 10} asset khác")
        lines.append("🔔 Đã tạo alert trong dashboard — ưu tiên vá ngay.")
    else:
        lines.append("✅ Không có asset nào trong inventory bị ảnh hưởng.")

    from . import telegram

    ok, detail = telegram.send_message("\n".join(lines))
    if not ok:
        log.warning("gửi report %s thất bại: %s", cve_id, detail)


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _poll_loop() -> None:
    global _offset
    api = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"
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
                params={
                    "timeout": 25,
                    "offset": _offset,
                    "allowed_updates": json.dumps(["message", "channel_post"]),
                },
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
                _stat["received"] += 1
                log.info("nhận tin CVE từ nhóm feed — xếp vào hàng đợi")
                handle_text(text)
        except httpx.HTTPError as exc:
            log.warning("getUpdates lỗi mạng: %s — thử lại sau 10s", exc)
            time.sleep(10)
        except Exception:
            log.exception("poll loop lỗi không xác định")
            time.sleep(10)
