"""Cấu hình backend đọc từ biến môi trường / file .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "data" / "techasset.db"))

# Nếu set, webhook /api/cve/push yêu cầu header "X-API-Key" khớp giá trị này.
CVE_PUSH_API_KEY = os.getenv("CVE_PUSH_API_KEY", "").strip()

SCHEDULER_TZ = os.getenv("SCHEDULER_TZ", "Asia/Ho_Chi_Minh")

SCANNER_USER_AGENT = os.getenv(
    "SCANNER_USER_AGENT",
    "Mozilla/5.0 (compatible; TechAsset-Scanner/2.0; Tech-Discovery-Engine)",
)
SCAN_DEFAULT_TIMEOUT = int(os.getenv("SCAN_DEFAULT_TIMEOUT", "8"))
SCAN_MAX_THREADS = int(os.getenv("SCAN_MAX_THREADS", "10"))

# Giới hạn số target chạy trong một lần kích hoạt cron job (giống bản mock: 15)
CRON_RUN_TARGET_LIMIT = 15

# Timeout (giây) cho 1 lần chạy subfinder tìm subdomain
SUBFINDER_TIMEOUT = int(os.getenv("SUBFINDER_TIMEOUT", "180"))

# Nuclei tech-detection (-tags tech,discovery)
NUCLEI_TAGS = os.getenv("NUCLEI_TAGS", "tech,discovery")
NUCLEI_TIMEOUT = int(os.getenv("NUCLEI_TIMEOUT", "180"))
# Template concurrency + rate limit (đẩy nhanh, vẫn ở mức lịch sự)
NUCLEI_CONCURRENCY = os.getenv("NUCLEI_CONCURRENCY", "50")
NUCLEI_RATE_LIMIT = os.getenv("NUCLEI_RATE_LIMIT", "250")

# httpx port probing
HTTPX_TIMEOUT = int(os.getenv("HTTPX_TIMEOUT", "600"))
HTTPX_THREADS = int(os.getenv("HTTPX_THREADS", "50"))

APP_VERSION = "2.0.0"

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Telegram bot
# TELEGRAM_CHAT_ID  = nhóm FEED chứa tin CVE (listener chỉ ĐỌC, không gửi vào)
# TELEGRAM_REPORT_CHAT_ID = nhóm NHẬN kết quả phân tích (mặc định fallback = TELEGRAM_CHAT_ID)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
TELEGRAM_REPORT_CHAT_ID = os.getenv("TELEGRAM_REPORT_CHAT_ID", "").strip()

# AI engine (OpenAI-compatible endpoint)
AI_API_BASE = os.getenv("AI_API_BASE", "").strip().rstrip("/")
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_MODEL = os.getenv("AI_MODEL", "").strip()
AI_TIMEOUT = int(os.getenv("AI_TIMEOUT", "300"))

# Bảo mật: login (basic + TOTP 2FA). Bỏ trống ADMIN_PASSWORD = tắt bảo mật
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()
TOTP_SECRET = os.getenv("TOTP_SECRET", "").strip()
SESSION_SECRET = os.getenv("SESSION_SECRET", "ta-dev-secret-change-me")
SESSION_HOURS = int(os.getenv("SESSION_HOURS", "12"))

# TLS (đường dẫn cert/key trong container; bỏ trống = chỉ HTTP)
TLS_CERTFILE = os.getenv("TLS_CERTFILE", "").strip()
TLS_KEYFILE = os.getenv("TLS_KEYFILE", "").strip()

# httpx tech-detect enrichment khi quét tech (version chi tiết hơn)
HTTPX_TECH_DETECT = os.getenv("HTTPX_TECH_DETECT", "1") not in ("0", "false", "no")
