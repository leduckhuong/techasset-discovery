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
