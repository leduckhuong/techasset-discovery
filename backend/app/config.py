"""Cấu hình backend đọc từ biến môi trường / file .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _int(key: str, default: int) -> int:
    """Đọc int từ env; chuỗi rỗng (do .env bị ghi KEY= trống) trả về default."""
    raw = os.getenv(key, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


HOST = os.getenv("HOST", "0.0.0.0")
PORT = _int("PORT", 8000)

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "data" / "techasset.db"))

# Nếu set, webhook /api/cve/push yêu cầu header "X-API-Key" khớp giá trị này.
CVE_PUSH_API_KEY = os.getenv("CVE_PUSH_API_KEY", "").strip()

SCHEDULER_TZ = os.getenv("SCHEDULER_TZ", "Asia/Ho_Chi_Minh")

SCANNER_USER_AGENT = os.getenv(
    "SCANNER_USER_AGENT",
    "Mozilla/5.0 (compatible; TechAsset-Scanner/2.0; Tech-Discovery-Engine)",
)
SCAN_DEFAULT_TIMEOUT = _int("SCAN_DEFAULT_TIMEOUT", 8)
SCAN_MAX_THREADS = _int("SCAN_MAX_THREADS", 10)

# Giới hạn số target chạy trong một lần kích hoạt cron job (giống bản mock: 15)
CRON_RUN_TARGET_LIMIT = 15

# Timeout (giây) cho 1 lần chạy subfinder tìm subdomain
SUBFINDER_TIMEOUT = _int("SUBFINDER_TIMEOUT", 180)

# Nuclei tech-detection (-tags tech,discovery)
NUCLEI_TAGS = os.getenv("NUCLEI_TAGS", "").strip() or "tech,discovery"
NUCLEI_TIMEOUT = _int("NUCLEI_TIMEOUT", 180)
# Template concurrency + rate limit (đẩy nhanh, vẫn ở mức lịch sự)
NUCLEI_CONCURRENCY = os.getenv("NUCLEI_CONCURRENCY", "").strip() or "50"
NUCLEI_RATE_LIMIT = os.getenv("NUCLEI_RATE_LIMIT", "").strip() or "250"

# httpx port probing
HTTPX_TIMEOUT = _int("HTTPX_TIMEOUT", 600)
HTTPX_THREADS = _int("HTTPX_THREADS", 50)

APP_VERSION = "2.0.0"

# Logging
LOG_LEVEL = (os.getenv("LOG_LEVEL", "").strip() or "INFO").upper()

# Telegram bot
# TELEGRAM_CHAT_ID  = nhóm FEED chứa tin CVE (listener chỉ ĐỌC, không gửi vào)
# TELEGRAM_REPORT_CHAT_ID = nhóm NHẬN kết quả phân tích (mặc định fallback = TELEGRAM_CHAT_ID)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
TELEGRAM_REPORT_CHAT_ID = os.getenv("TELEGRAM_REPORT_CHAT_ID", "").strip()

# Telegram user session (MTProto/Telethon) — đọc nhóm feed bằng tài khoản user,
# nhìn thấy TẤT CẢ tin nhắn (không dính privacy mode như bot). READ-ONLY.
TELEGRAM_API_ID = _int("TELEGRAM_API_ID", 0)
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "").strip()
TELEGRAM_USER_LISTEN = os.getenv("TELEGRAM_USER_LISTEN", "1").strip() not in ("0", "false", "no")
TELEGRAM_SESSION_PATH = os.getenv(
    "TELEGRAM_SESSION_PATH", str(BASE_DIR / "data" / "telegram" / "user_session")
)
# Tự quét lịch sử N giờ mỗi lần listener start (0 = tắt; bấm nút để quét tay)
TELEGRAM_BACKFILL_HOURS = _int("TELEGRAM_BACKFILL_HOURS", 0)

# AI engine (OpenAI-compatible endpoint)
AI_API_BASE = os.getenv("AI_API_BASE", "").strip().rstrip("/")
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_MODEL = os.getenv("AI_MODEL", "").strip()
AI_TIMEOUT = _int("AI_TIMEOUT", 300)

# Bảo mật: login (basic + TOTP 2FA). Bỏ trống ADMIN_PASSWORD = tắt bảo mật
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()
TOTP_SECRET = os.getenv("TOTP_SECRET", "").strip()
SESSION_SECRET = os.getenv("SESSION_SECRET", "ta-dev-secret-change-me")
SESSION_HOURS = _int("SESSION_HOURS", 12)

# TLS (đường dẫn cert/key trong container; bỏ trống = chỉ HTTP)
TLS_CERTFILE = os.getenv("TLS_CERTFILE", "").strip()
TLS_KEYFILE = os.getenv("TLS_KEYFILE", "").strip()

# httpx tech-detect enrichment khi quét tech (version chi tiết hơn)
HTTPX_TECH_DETECT = os.getenv("HTTPX_TECH_DETECT", "1").strip() not in ("0", "false", "no")

# Hàng đợi xử lý tin CVE từ nhóm feed (chống DoS khi burst)
TELEGRAM_QUEUE_WORKERS = _int("TELEGRAM_QUEUE_WORKERS", 2)
TELEGRAM_QUEUE_MAXSIZE = _int("TELEGRAM_QUEUE_MAXSIZE", 1000)
