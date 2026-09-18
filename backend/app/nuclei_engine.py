"""
Nuclei tech-detection engine: chạy `nuclei -tags tech,discovery` cho 1 URL
để nhận diện công nghệ bổ sung (dựa trên bộ template wappalyzer/technologies
của nuclei) — thông tin đầy đủ hơn fingerprint header/body cơ bản.
"""
import json
import logging
import shutil
import subprocess
import time

from . import config

log = logging.getLogger("nuclei")

# Màu Nuclei (xanh lá thương hiệu)
NUCLEI_COLOR = "#58a6ff"

# info.tags -> category hiển thị
_TAG_CATEGORY_MAP = [
    ("waf", "Security"),
    ("cdn", "CDN"),
    ("cms", "CMS"),
    ("framework", "Framework"),
    ("tech", "Technology"),
]


def nuclei_available() -> bool:
    return shutil.which("nuclei") is not None


def _category_from_tags(tags: list) -> str:
    for needle, category in _TAG_CATEGORY_MAP:
        if needle in tags:
            return category
    return "Technology"


def run_nuclei_tech(target_url: str) -> list[dict]:
    """
    Chạy nuclei với tags tech,discovery cho 1 URL. Trả về list tech entry
    dạng tương thích technologies: {name, category, version?, source, templateId?}.
    Lỗi/times out/empty → trả list rỗng (scanner vẫn chạy bình thường).
    """
    binary = shutil.which("nuclei")
    if not binary:
        return []
    started = time.monotonic()
    try:
        proc = subprocess.run(
            [binary, "-u", target_url, "-tags", config.NUCLEI_TAGS,
             "-silent", "-j", "-nc",
             "-c", config.NUCLEI_CONCURRENCY, "-rl", config.NUCLEI_RATE_LIMIT],
            capture_output=True,
            text=True,
            timeout=config.NUCLEI_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        log.warning("nuclei TIMEOUT sau %ss: %s", config.NUCLEI_TIMEOUT, target_url)
        return []
    except OSError as exc:
        log.error("nuclei không chạy được: %s", exc)
        return []

    entries: dict[str, dict] = {}
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        info = obj.get("info") or {}
        name = (info.get("name") or "").strip()
        template_id = obj.get("template-id") or obj.get("template") or ""
        if not name and not template_id:
            continue

        tags = info.get("tags") or []
        matcher = obj.get("matcher-name") or ""
        # waf-detect bắn nhiều matcher (nginxgeneric...) — hiện matcher để biết engine cụ thể
        display = f"{name} [{matcher}]" if matcher and name.lower() not in matcher.lower() else name
        # Gom theo template+matcher: nhiều version (VD TLS 1.0/1.1/1.2) gộp 1 entry
        key = f"{template_id}:{matcher}" or display.lower()
        extracted = obj.get("extracted-results") or []

        if key in entries:
            if extracted:
                old = entries[key].get("version") or ""
                new_vals = [v for v in extracted if v and str(v) not in old]
                if new_vals:
                    entries[key]["version"] = f"{old}, {', '.join(str(v) for v in new_vals)}"[:96]
            continue

        entry = {
            "name": display,
            "category": _category_from_tags(tags),
            "color": NUCLEI_COLOR,
            "source": "nuclei",
        }
        if template_id:
            entry["templateId"] = template_id
        if extracted:
            entry["version"] = ", ".join(str(v) for v in extracted[:3])[:96]
        entries[key] = entry

    log.info("nuclei %s -> %d findings | %.1fs", target_url, len(entries), time.monotonic() - started)
    return list(entries.values())
