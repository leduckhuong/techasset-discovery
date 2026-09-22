"""
Bảo mật app: session login (username + password + TOTP 2FA) và HTTPS-ready.

- Bật khi set ADMIN_PASSWORD trong backend/.env. Bỏ trống = tắt bảo mật (dev).
- API bot vẫn vào được qua header X-API-Key (trùng CVE_PUSH_API_KEY).
- /api/health và trang /login được miễn xác thực.
"""
import logging
from datetime import datetime, timezone

import itsdangerous
import pyotp
from fastapi import Request

from . import config

log = logging.getLogger("security")

SESSION_COOKIE = "ta_session"
_EXPIEMPT_PREFIXES = ("/login", "/logout", "/api/health")
_exempt_exact = {"/favicon.ico"}
_EXEMPT_PREFIXES = ("/login", "/logout", "/api/health")


def enabled() -> bool:
    return bool(config.ADMIN_PASSWORD)


def _serializer() -> itsdangerous.URLSafeTimedSerializer:
    return itsdangerous.URLSafeTimedSerializer(config.SESSION_SECRET, salt="ta-session")


def _is_exempt(path: str) -> bool:
    return path in _exempt_exact or any(path.startswith(p) for p in _EXEMPT_PREFIXES)


def _api_key_ok(request: Request) -> bool:
    key = config.CVE_PUSH_API_KEY
    return bool(key) and request.headers.get("X-API-Key") == key


def session_ok(request: Request) -> bool:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return False
    try:
        data = _serializer().loads(token, max_age=config.SESSION_HOURS * 3600)
        return data.get("u") == config.ADMIN_USERNAME
    except Exception:
        return False


def request_authorized(request: Request) -> bool:
    if not enabled():
        return True
    if _is_exempt(request.url.path):
        return True
    if _api_key_ok(request):
        return True
    return session_ok(request)


def login(username: str, password: str, totp: str) -> tuple[bool, str | None]:
    """Xác thực user/pass + mã 2FA. Trả về (ok, token hoặc lỗi)."""
    if username != config.ADMIN_USERNAME or password != config.ADMIN_PASSWORD:
        log.warning("login sai thông tin từ %s", username)
        return False, "Sai username hoặc password"
    if config.TOTP_SECRET:
        if not totp.strip():
            return False, "Thiếu mã 2FA (TOTP)"
        if not pyotp.TOTP(config.TOTP_SECRET).verify(totp.strip(), valid_window=1):
            return False, "Mã 2FA không đúng hoặc đã hết hạn"
    token = _serializer().dumps({"u": username, "t": datetime.now(timezone.utc).isoformat()})
    return True, token


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=config.SESSION_HOURS * 3600,
        httponly=True, samesite="lax", secure=bool(config.TLS_CERTFILE),
    )


LOGIN_PAGE = """<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đăng nhập — TechAsset Discovery</title>
<style>
  body{margin:0;font-family:ui-sans-serif,system-ui;background:#0b0e18;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#121522;border:1px solid #232736;border-radius:14px;padding:32px;width:360px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
  h1{font-size:16px;margin:0 0 4px;color:#fff}p.sub{font-size:12px;color:#64748b;margin:0 0 20px}
  label{display:block;font-size:11px;color:#94a3b8;margin:12px 0 4px;font-weight:600}
  input{width:100%;box-sizing:border-box;background:#0d1120;border:1px solid #2a3350;border-radius:8px;padding:9px 12px;color:#e2e8f0;font-size:13px;outline:none}
  input:focus{border-color:#6366f1}
  button{width:100%;margin-top:20px;background:#6366f1;border:0;color:#fff;padding:11px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
  button:hover{background:#4f46e5}
  .err{background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d;border-radius:8px;padding:8px 12px;font-size:12px;margin-bottom:8px}
  .logo{width:40px;height:40px;border-radius:10px;background:#6366f1;display:flex;align-items:center;justify-content:center;font-weight:800;margin-bottom:14px}
</style></head><body>
<div class="card">
  <div class="logo">🛡️</div>
  <h1>TechAsset Discovery</h1>
  <p class="sub">Đăng nhập để truy cập asset inventory</p>
  {error}
  <form method="post" action="/login">
    <label>Username</label><input name="username" autocomplete="username" required>
    <label>Password</label><input name="password" type="password" autocomplete="current-password" required>
    <label>Mã 2FA (TOTP)</label><input name="totp" inputmode="numeric" autocomplete="one-time-code" placeholder="6 chữ số" required>
    <button>Đăng nhập</button>
  </form>
</div>
</body></html>"""


def register_login_routes(app) -> None:
    from fastapi import Form
    from fastapi.responses import HTMLResponse, RedirectResponse

    @app.get("/login", include_in_schema=False)
    def login_page(error: str = ""):
        err_html = f'<div class="err">{error}</div>' if error else ""
        return HTMLResponse(LOGIN_PAGE.replace("{error}", err_html))

    @app.post("/login", include_in_schema=False)
    def login_submit(request: Request, username: str = Form(""), password: str = Form(""), totp: str = Form("")):
        ok, token_or_err = login(username, password, totp)
        if not ok:
            return RedirectResponse(f"/login?error={token_or_err}", status_code=303)
        resp = RedirectResponse("/", status_code=303)
        set_session_cookie(resp, token_or_err)
        return resp

    @app.get("/logout", include_in_schema=False)
    def logout():
        resp = RedirectResponse("/login", status_code=303)
        resp.delete_cookie(SESSION_COOKIE)
        return resp


def totp_uri(username: str) -> str | None:
    if not config.TOTP_SECRET:
        return None
    return pyotp.TOTP(config.TOTP_SECRET).provisioning_uri(
        name=username, issuer_name="TechAsset Discovery"
    )
