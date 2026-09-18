"""
httpx engine (ProjectDiscovery): dò các web port phổ biến trên danh sách
host/subdomain — phát hiện service chạy trên port không mặc định (8080, 8443,
9090...) và thu thập status/title/webserver/tech cho từng service tìm thấy.
"""
import asyncio
import json
import logging
import shutil
import time
from urllib.parse import urlparse

from . import config

log = logging.getLogger("httpx")

# Danh sách web port phổ biến (top web ports — naabu/httpx probing list)
DEFAULT_WEB_PORTS = (
    "80,443,8009,8180,81,300,591,593,832,981,1000,1010,1311,2082,2087,2095,2096,"
    "2480,3000,3128,3333,4243,4567,4711,4712,4993,5000,5104,5108,5800,6443,6543,"
    "7000,7396,7474,8000,8001,8008,8014,8042,8069,8080,8081,8088,8090,8091,8118,"
    "8123,8172,8222,8243,8280,8281,8333,8443,8500,8834,8880,8888,8983,9000,9043,"
    "9060,9080,9090,9091,9200,9443,9800,9981,10000,12443,16080,18091,18092,20720,28017"
)

HTTPX_COLOR = "#3da639"


def httpx_available() -> bool:
    return shutil.which("httpx") is not None


def _parse_time_ms(raw) -> int | None:
    """'12.212869ms' / '1.2s' / '542µs' -> milliseconds int."""
    if not raw:
        return None
    s = str(raw).strip()
    try:
        if s.endswith("ms"):
            return int(float(s[:-2]))
        if s.endswith("µs") or s.endswith("us"):
            return max(1, int(float(s[:-2]) / 1000))
        if s.endswith("s"):
            return int(float(s[:-1]) * 1000)
        return int(float(s))
    except ValueError:
        return None


def _clean_host(raw: str) -> str | None:
    host = raw.strip().lower()
    for prefix in ("http://", "https://"):
        if host.startswith(prefix):
            host = host[len(prefix):]
    slash = host.find("/")
    if slash != -1:
        host = host[:slash]
    return host or None


async def probe_hosts(hosts: list[str], ports: str | None = None) -> list[dict]:
    """
    Chạy httpx trên danh sách host với dải port web. Trả về raw JSON entries
    (url, host, port, scheme, status_code, title, webserver, tech, ip, time...).
    httpx không có / lỗi / timeout -> trả rỗng.
    """
    binary = shutil.which("httpx")
    if not binary:
        raise RuntimeError("httpx binary not found in PATH")

    clean = []
    seen = set()
    for h in hosts:
        c = _clean_host(str(h))
        if c and c not in seen:
            seen.add(c)
            clean.append(c)
    if not clean:
        return []

    proc = await asyncio.create_subprocess_exec(
        binary,
        "-ports", ports or DEFAULT_WEB_PORTS,
        "-json", "-silent", "-nc", "-tech-detect", "-fr",
        "-threads", str(config.HTTPX_THREADS),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    started = time.monotonic()
    try:
        out, _ = await asyncio.wait_for(
            proc.communicate("\n".join(clean).encode()), timeout=config.HTTPX_TIMEOUT
        )
    except asyncio.TimeoutError:
        proc.kill()
        log.warning("httpx TIMEOUT sau %ss: %d hosts", config.HTTPX_TIMEOUT, len(clean))
        raise RuntimeError(f"httpx timed out after {config.HTTPX_TIMEOUT}s")

    entries = []
    for line in out.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            entries.append(json.loads(line))
        except ValueError:
            continue
    log.info("httpx %d hosts × ports -> %d services | %.1fs", len(clean), len(entries), time.monotonic() - started)
    return entries


def build_scan_result(entry: dict, asset_group_id: str | None = None) -> dict | None:
    """Chuyển 1 entry JSON của httpx thành ScanResult để lưu vào assets."""
    url = entry.get("url")
    if not url:
        return None
    parsed = urlparse(url)
    host = parsed.hostname or entry.get("host")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    techs = []
    for t in entry.get("tech") or []:
        if not t:
            continue
        # httpx trả "Name:1.2.3" — tách name/version
        name, version = str(t), None
        if ":" in t:
            candidate_name, _, candidate_ver = t.rpartition(":")
            if candidate_ver and candidate_ver[0].isdigit():
                name, version = candidate_name, candidate_ver[:32]
        item = {"name": name, "category": "Technology", "color": HTTPX_COLOR, "source": "httpx"}
        if version:
            item["version"] = version
        techs.append(item)

    return {
        "id": None,  # inventory tự sinh theo url
        "url": url,
        "finalUrl": url,
        "host": host,
        "port": port,
        "scheme": parsed.scheme,
        "statusCode": int(entry.get("status_code") or 0),
        "statusText": None,
        "title": (entry.get("title") or "").strip() or None,
        "webServer": entry.get("webserver"),
        "contentLength": entry.get("content_length"),
        "contentType": None,
        "responseTimeMs": _parse_time_ms(entry.get("time")),
        "ip": entry.get("ip"),
        "asn": None,
        "technologies": techs,
        "labels": [],
        "assetGroupId": asset_group_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()),
    }
