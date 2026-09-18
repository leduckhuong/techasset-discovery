"""
Tech discovery scanner: fetch 1 URL/subdomain -> ScanResult.
Bao gồm: DNS resolve, HTTP fetch (follow redirect, lấy redirect chain),
fingerprint công nghệ, trích title/labels, và đọc SSL cert thật (issuer/expiry).
"""
import socket
import ssl
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlparse

import logging

import httpx

from . import config
from .nuclei_engine import run_nuclei_tech
from .tech_rules import detect_technologies

log = logging.getLogger("scanner")

# Scanner chỉ fingerprint, không xác thực chứng chỉ của mục tiêu
_httpx_verify = False

# Giới hạn cứng phần body đọc vào RAM (đã decompress) — chống OOM khi target
# trả file lớn / stream vô hạn / gzip bomb. Fingerprint chỉ cần ~250KB đầu.
MAX_BODY_BYTES = 300_000

ASN_PREFIX_HINTS = [
    ((104, 172), "AS13335 | Cloudflare Inc."),
    ((14, 123, 203), "AS135905 | VNPT VN-POST"),
    ((115, 125, 171), "AS9790 | Viettel Group"),
    ((118, 42), "AS18403 | FPT Telecom"),
    ((75, 34, 35), "AS15169 | Google Cloud"),
]


def normalize_target(raw_url: str) -> tuple[str, str, int]:
    """'sub.example.com' -> ('https://sub.example.com', host, port). Trả về (url, host, port)."""
    target = raw_url.strip()
    if not target:
        raise ValueError("Empty URL")
    if not target.lower().startswith(("http://", "https://")):
        target = "https://" + target
    parsed = urlparse(target)
    host = parsed.hostname
    if not host:
        raise ValueError(f"Invalid URL: {raw_url}")
    scheme = parsed.scheme.lower()
    port = parsed.port or (443 if scheme == "https" else 80)
    return target, host, port


def resolve_ip(host: str) -> str | None:
    try:
        infos = socket.getaddrinfo(host, None)
        return infos[0][4][0]
    except OSError:
        return None


def _asn_from_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    first_octet = ip.split(".")[0]
    try:
        n = int(first_octet)
    except ValueError:
        return None
    for octets, asn in ASN_PREFIX_HINTS:
        if n in octets:
            return asn
    return None


def _extract_title(body: str) -> str | None:
    start = body.lower().find("<title")
    if start == -1:
        return None
    tag_end = body.find(">", start)
    close = body.lower().find("</title>", tag_end)
    if tag_end == -1 or close == -1:
        return None
    title = body[tag_end + 1:close].strip()
    return " ".join(title.split()) or None


def _get_ssl_info(host: str, port: int) -> dict | None:
    """Đọc chứng chỉ TLS thật của host (issuer, CN, ngày hết hạn)."""
    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((host, port), timeout=6) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls_sock:
                der = tls_sock.getpeercert(binary_form=True)
        if not der:
            return None
        from cryptography import x509
        from cryptography.x509.oid import NameOID

        cert = x509.load_der_x509_certificate(der)
        cn_attrs = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
        issuer_attrs = cert.issuer.get_attributes_for_oid(NameOID.COMMON_NAME)
        expiry = cert.not_valid_after_utc
        days_remaining = (expiry - datetime.now(timezone.utc)).days
        return {
            "valid": days_remaining >= 0,
            "issuer": issuer_attrs[0].value if issuer_attrs else "Unknown",
            "commonName": cn_attrs[0].value if cn_attrs else host,
            "expiryDate": expiry.isoformat(),
            "daysRemaining": days_remaining,
            "expiredAgoDays": -days_remaining if days_remaining < 0 else 0,
        }
    except Exception:
        return None


def _smart_labels(host: str, title: str | None) -> list[str]:
    labels = []
    if "gov.vn" in host:
        labels.append("Government")
    if any(k in host for k in ("login", "auth")) or (title and ("đăng nhập" in title.lower() or "login" in title.lower() or "portal" in title.lower())):
        labels.append("Authentication")
    if any(k in host for k in ("cloud", "admin", "manage")):
        labels.append("Internal Tool")
    if any(k in host for k in ("thuvien", "docs", "wiki")):
        labels.append("Documentation")
    return labels


def scan_target(raw_url: str, timeout_sec: float | None = None,
                tech_detect: bool = True, follow_redirects: bool = True,
                asset_group_id: str | None = None,
                use_nuclei: bool = False) -> dict:
    """Quét 1 target. Luôn trả về ScanResult (statusCode=0 nếu unreachable)."""
    timeout_sec = timeout_sec or config.SCAN_DEFAULT_TIMEOUT
    started = time.monotonic()
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        target_url, host, port = normalize_target(raw_url)
    except ValueError as exc:
        return {
            "id": uuid.uuid4().hex[:8], "url": raw_url, "host": str(raw_url),
            "scheme": "https", "statusCode": 0, "statusText": "Invalid URL",
            "title": "Invalid Target", "responseTimeMs": 0, "technologies": [],
            "headers": {}, "timestamp": timestamp, "error": str(exc),
        }

    scheme = "https" if target_url.lower().startswith("https://") else "http"
    ip = resolve_ip(host)

    result = {
        "id": uuid.uuid4().hex[:8],
        "url": target_url,
        "host": host,
        "port": port,
        "scheme": scheme,
        "statusCode": 0,
        "statusText": "Connection Failed",
        "title": "Unreachable Host",
        "responseTimeMs": None,
        "ip": ip,
        "asn": _asn_from_ip(ip),
        "technologies": [],
        "headers": {},
        "timestamp": timestamp,
    }
    if asset_group_id:
        result["assetGroupId"] = asset_group_id

    try:
        with httpx.Client(
            verify=_httpx_verify,
            follow_redirects=follow_redirects,
            timeout=httpx.Timeout(timeout_sec),
            headers={
                "User-Agent": config.SCANNER_USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
        ) as client:
            # BẮT BUỘC stream + cap: đọc tối đa MAX_BODY_BYTES (decompressed).
            # Nếu .get()/resp.text thì body lớn (file, captive portal, gzip bomb)
            # sẽ nạp toàn bộ vào RAM và OOM-kill process backend.
            with client.stream("GET", target_url) as resp:
                result["statusCode"] = resp.status_code
                result["statusText"] = resp.reason_phrase
                result["finalUrl"] = str(resp.url)

                headers_map = {}
                for key, value in resp.headers.multi_items():
                    k = key.lower()
                    headers_map[k] = f"{headers_map[k]}, {value}" if k in headers_map else value
                result["headers"] = headers_map

                if resp.history:
                    result["chain"] = [str(r.url) for r in resp.history] + [str(resp.url)]

                raw = bytearray()
                try:
                    for chunk in resp.iter_bytes():
                        raw.extend(chunk)
                        if len(raw) >= MAX_BODY_BYTES:
                            break
                except (httpx.StreamError, httpx.DecodingError):
                    pass  # stream đứt giữa chừng — vẫn dùng phần đã đọc

        result["responseTimeMs"] = int((time.monotonic() - started) * 1000)
        body = bytes(raw).decode("utf-8", errors="replace")[:MAX_BODY_BYTES]

        title = _extract_title(body)
        result["title"] = title or ("No title" if result["statusCode"] == 200 else f"Status {result['statusCode']}")
        result["webServer"] = headers_map.get("server")
        result["contentType"] = headers_map.get("content-type")
        cl = headers_map.get("content-length")
        result["contentLength"] = int(cl) if cl and cl.isdigit() else len(raw)
        result["labels"] = _smart_labels(host, title)

        if tech_detect:
            result["technologies"] = detect_technologies(headers_map, body)

            # Enrichment bằng nuclei (-tags tech,discovery): thêm tech mà
            # fingerprint cơ bản không bắt được + điền version còn thiếu
            if use_nuclei:
                for entry in run_nuclei_tech(target_url):
                    existing = next(
                        (t for t in result["technologies"]
                         if t["name"].lower() == entry["name"].lower()),
                        None,
                    )
                    if existing is None:
                        result["technologies"].append(entry)
                    elif not existing.get("version") and entry.get("version"):
                        existing["version"] = entry["version"]
                        existing.setdefault("source", "nuclei")
    except httpx.TimeoutException:
        result["responseTimeMs"] = int((time.monotonic() - started) * 1000)
        result["statusText"] = "Timeout"
        result["error"] = f"Request timed out after {timeout_sec}s"
    except Exception as exc:  # lỗi mạng/DNS/TLS — vẫn trả kết quả rỗng kèm error
        result["responseTimeMs"] = int((time.monotonic() - started) * 1000)
        result["error"] = str(exc) or exc.__class__.__name__

    if scheme == "https" and result["statusCode"] > 0:
        ssl_info = _get_ssl_info(host, port)
        if ssl_info:
            result["ssl"] = ssl_info

    log.info(
        "%s -> %s | %d techs | %sms | ip=%s%s",
        target_url, result["statusCode"], len(result["technologies"]),
        result["responseTimeMs"], result.get("ip") or "-",
        f" | err={result['error']}" if result.get("error") else "",
    )
    return result


def scan_many(urls: list, timeout_sec: float | None = None, threads: int = 5,
              tech_detect: bool = True, follow_redirects: bool = True,
              asset_group_id: str | None = None, use_nuclei: bool = False) -> list:
    """Quét song song nhiều URL, giữ thứ tự đầu vào."""
    threads = max(1, min(int(threads or 5), config.SCAN_MAX_THREADS))
    if use_nuclei:
        # mỗi tiến trình nuclei tự chạy 50 template concurrency — giới hạn số target song song
        threads = min(threads, 4)
    with ThreadPoolExecutor(max_workers=threads) as pool:
        futures = [
            pool.submit(scan_target, u, timeout_sec, tech_detect, follow_redirects,
                        asset_group_id, use_nuclei)
            for u in urls
        ]
        return [f.result() for f in futures]
