"""Telegram USER SESSION (Telethon/MTProto) — đọc nhóm feed bằng tài khoản user.

Bot Telegram bị privacy mode chặn và không đọc được lịch sử chat; tài khoản user
thì nhìn thấy TẤT CẢ tin nhắn trong nhóm. Module này:
  - login flow: send_code -> verify code (+ password 2FA) -> lưu session file
  - listener: event NewMessage trên nhóm feed -> đẩy text vào pipeline CVE có sẵn
  - backfill: đọc lịch sử N giờ gần nhất -> đẩy vào pipeline (notify=False)

KIẾN TRÚC LOOP: Telethon yêu cầu 1 client chỉ sống trên 1 event loop, nên toàn bộ
thao tác (login/listener/backfill) chạy trên MỘT event loop nền duy nhất
(_tg_loop thread), gọi từ thread HTTP qua run_coroutine_threadsafe.

AN TOÀN: client user CHỈ ĐỌC (connect/iter_messages/event handler). Không có
đường nào gửi tin bằng client user; report Telegram vẫn đi qua BOT token.
"""
import asyncio
import logging
import os
import threading
from datetime import datetime, timezone, timedelta

import re as _re

from . import config, telegram_listener

log = logging.getLogger("tg-user")

CVE_RE = _re.compile(r"CVE-\d{4}-\d{4,7}", _re.I)

_loop: asyncio.AbstractEventLoop | None = None
_loop_ready = threading.Event()
_login_client = None  # client tạm trong lúc đăng nhập
_login_info: dict = {}
_client = None        # client listener chính (dùng chung cho backfill)
_user_info: dict | None = None
_stat = {"backfills": 0, "backfillMessages": 0, "backfillCves": 0, "lastBackfill": None}

_backfill_state: dict = {"running": False, "done": 0, "total": 0, "hours": 0, "startedAt": None, "error": None}


# ============================== Event loop nền duy nhất ==============================

def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is not None and _loop.is_running():
        return _loop
    _loop_ready.clear()

    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        globals()["_loop"] = loop
        _loop_ready.set()
        loop.run_forever()

    threading.Thread(target=_run, daemon=True, name="tg-user-loop").start()
    _loop_ready.wait(timeout=10)
    return _loop


def _submit(coro, timeout: float | None = 60):
    """Chạy coroutine trên loop nền; timeout=None = fire-and-forget."""
    loop = _get_loop()
    fut = asyncio.run_coroutine_threadsafe(coro, loop)
    if timeout is None:
        return None
    return fut.result(timeout=timeout)


def _make_client():
    from telethon import TelegramClient

    os.makedirs(os.path.dirname(config.TELEGRAM_SESSION_PATH) or ".", exist_ok=True)
    return TelegramClient(config.TELEGRAM_SESSION_PATH, config.TELEGRAM_API_ID, config.TELEGRAM_API_HASH)


def configured() -> bool:
    return bool(config.TELEGRAM_API_ID and config.TELEGRAM_API_HASH and config.TELEGRAM_CHAT_ID)


def status() -> dict:
    return {
        "configured": configured(),
        "loggedIn": _user_info is not None,
        "user": _user_info,
        "listening": _client is not None,
        "feedChatId": config.TELEGRAM_CHAT_ID,
        "backfillHours": config.TELEGRAM_BACKFILL_HOURS,
        **_stat,
    }


# ============================== Login flow ==============================

async def _login_start_coro(phone: str) -> dict:
    """Ngắt listener client (cùng giữ session file) rồi gửi mã OTP."""
    global _login_client, _login_info, _client, _user_info
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass
        _client = None
    if _login_client is not None:
        try:
            await _login_client.disconnect()
        except Exception:
            pass
    client = _make_client()
    await client.connect()
    sent = await client.send_code_request(phone)
    _login_client = client
    _login_info = {"phone": phone, "hash": sent.phone_code_hash}
    return {"ok": True, "phoneCodeHash": sent.phone_code_hash, "note": "Mã OTP đã gửi tới Telegram của bạn"}


def login_start(phone: str) -> dict:
    if not configured():
        return {"ok": False, "error": "Chưa cấu hình TELEGRAM_API_ID / TELEGRAM_API_HASH"}
    try:
        return _submit(_login_start_coro(phone.strip()), timeout=90)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


async def _login_verify_coro(code: str, password: str | None) -> dict:
    global _login_client, _login_info, _user_info
    from telethon import errors as tg_errors

    if _login_client is None:
        return {"ok": False, "error": "Chưa gửi mã OTP — bấm 'Gửi mã OTP' trước"}
    try:
        await _login_client.sign_in(phone=_login_info["phone"], code=code)
    except tg_errors.SessionPasswordNeededError:
        if not password:
            return {"ok": False, "needPassword": True, "error": "Tài khoản bật mật khẩu 2FA — nhập thêm password"}
        await _login_client.sign_in(password=password)
    me = await _login_client.get_me()
    await _login_client.disconnect()
    _login_client = None
    _login_info = {}
    _user_info = {"id": me.id, "firstName": me.first_name, "username": me.username}
    log.info("user session đăng nhập OK: %s", _user_info)
    return {"ok": True, "user": _user_info}


def login_verify(code: str, password: str | None = None) -> dict:
    try:
        return _submit(_login_verify_coro(code.strip(), password), timeout=90)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


async def _load_saved_session_coro() -> dict | None:
    global _user_info
    client = _make_client()
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return None
        me = await client.get_me()
        _user_info = {"id": me.id, "firstName": me.first_name, "username": me.username}
        return _user_info
    finally:
        await client.disconnect()


def load_saved_session() -> bool:
    """Kiểm tra session file còn hợp lệ; đúng thì ghi nhớ user."""
    if not configured():
        return False
    if not (os.path.exists(config.TELEGRAM_SESSION_PATH + ".session")
            or os.path.exists(config.TELEGRAM_SESSION_PATH)):
        return False
    try:
        return _submit(_load_saved_session_coro(), timeout=60) is not None
    except Exception as exc:
        log.warning("session cũ lỗi: %s", exc)
        return False


async def _logout_coro() -> dict:
    global _user_info, _client
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass
        _client = None
    client = _make_client()
    await client.connect()
    try:
        await client.log_out()
    finally:
        await client.disconnect()
    return {"ok": True}


def logout() -> dict:
    global _user_info
    try:
        _submit(_logout_coro(), timeout=60)
    except Exception as exc:
        log.warning("logout lỗi (vẫn xoá session local): %s", exc)
    for suffix in (".session", ""):
        p = config.TELEGRAM_SESSION_PATH + suffix
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass
    _user_info = None
    return {"ok": True}


# ============================== Listener (trên loop nền) ==============================

async def _listen_start_coro() -> dict:
    global _client, _user_info
    from telethon import events

    if _client is not None:
        return {"ok": True, "note": "listener đang chạy"}
    client = _make_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        return {"ok": False, "error": "Session chưa đăng nhập hoặc đã hết hạn"}
    try:
        chat = await client.get_entity(int(config.TELEGRAM_CHAT_ID))
    except Exception as exc:
        await client.disconnect()
        return {"ok": False, "error": f"Không truy cập được nhóm feed: {exc}"}

    async def _on_new(event):
        text = event.raw_text or ""
        if CVE_RE.search(text):
            log.info("user-session nhận tin CVE mới từ nhóm feed")
            telegram_listener.handle_text(text, config.TELEGRAM_CHAT_ID)

    client.add_event_handler(_on_new, events.NewMessage(chats=[chat]))
    _client = client
    log.info("user-session listener ON (đọc nhóm feed %s bằng tài khoản %s)",
             config.TELEGRAM_CHAT_ID, (_user_info or {}).get("firstName"))
    return {"ok": True}


async def _listen_stop_coro() -> None:
    global _client
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass
        _client = None


def start_listener(backfill_hours: int | None = None) -> dict:
    """Bật listener đọc nhóm feed bằng user session (queue workers phải chạy)."""
    if not configured():
        return {"ok": False, "error": "Chưa cấu hình TELEGRAM_API_ID / TELEGRAM_API_HASH"}
    if not _user_info and not load_saved_session():
        return {"ok": False, "error": "Chưa đăng nhập user session"}
    telegram_listener.ensure_workers()
    try:
        result = _submit(_listen_start_coro(), timeout=60)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    if isinstance(result, dict) and result.get("ok") and backfill_hours:
        start_backfill(backfill_hours)
    return result or {"ok": False, "error": "listener không phản hồi"}


def stop_listener() -> None:
    if _loop is not None and _loop.is_running():
        try:
            _submit(_listen_stop_coro(), timeout=15)
        except Exception:
            pass


# ============================== Backfill lịch sử (READ-ONLY) ==============================

async def _backfill_coroutine(hours: int) -> dict:
    """Đọc lịch sử nhóm feed `hours` giờ gần nhất, đẩy tin chứa CVE vào pipeline.
    notify=False: KHÔNG gửi report Telegram khi backfill."""
    global _client
    client = _client
    own = client is None
    if own:
        client = _make_client()
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            _backfill_state.update(running=False, error="Session chưa đăng nhập")
            return {"ok": False, "error": "Session chưa đăng nhập"}

    _backfill_state.update(running=True, done=0, total=0, hours=hours,
                           startedAt=datetime.now(timezone.utc).isoformat(), error=None)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    seen: set[int] = set()
    try:
        async for msg in client.iter_messages(int(config.TELEGRAM_CHAT_ID)):
            if msg.date and msg.date.replace(tzinfo=timezone.utc) < since:
                break
            _backfill_state["done"] += 1
            text = msg.raw_text or ""
            if not text or msg.id in seen or not CVE_RE.search(text):
                continue
            seen.add(msg.id)
            _backfill_state["total"] += 1
            # queue worker xử lý; CVE trùng sẽ bị _process_cve bỏ qua
            telegram_listener.handle_text(text, config.TELEGRAM_CHAT_ID)
    except Exception as exc:
        _backfill_state["error"] = f"{type(exc).__name__}: {exc}"
        log.exception("backfill lỗi")
    finally:
        if own:
            await client.disconnect()
    _backfill_state["running"] = False
    _stat["backfills"] += 1
    _stat["backfillMessages"] += _backfill_state["done"]
    _stat["backfillCves"] += _backfill_state["total"]
    _stat["lastBackfill"] = datetime.now(timezone.utc).isoformat()
    log.info("backfill %sh xong: %d tin quét, %d tin chứa CVE", hours, _backfill_state["done"], _backfill_state["total"])
    return {"ok": True, **_backfill_state}


def start_backfill(hours: int) -> dict:
    """Kích hoạt backfill trên listener client (tự start listener nếu chưa)."""
    if not _user_info and not load_saved_session():
        return {"ok": False, "error": "Chưa đăng nhập user session"}
    if _backfill_state.get("running"):
        return {"ok": False, "error": "Backfill đang chạy"}
    if _client is None:
        r = start_listener(backfill_hours=0)
        if not r.get("ok"):
            return r
    hours = max(1, min(int(hours), 24 * 7))
    _submit(_backfill_coroutine(hours), timeout=None)  # chạy nền, không đợi
    return {"ok": True, "hours": hours}


def backfill_status() -> dict:
    return {"running": _backfill_state.get("running"), **_backfill_state,
            **{k: v for k, v in _stat.items()}}
