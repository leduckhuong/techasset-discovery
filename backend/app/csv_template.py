"""
Parser cho template CSV cố định dạng "domain list" (ví dụ: List domain VCCORP).

Cấu trúc template:
  - Dòng đầu là header, bắt buộc có 1 cột DOMAIN (hoặc subdomain/host/...).
  - Các cột còn lại là metadata (DỰ ÁN, EMAIL SẼ QUẢN LÝ DOMAIN, TRẠNG THÁI
    CHUYỂN, NOTE, NGƯỜI PHỤ TRÁCH, PROJECT, STATUS...). Toàn bộ metadata
    đều được giữ lại và gắn vào asset / asset group.
  - Mỗi domain gốc (eTLD+1, xử lý đúng .vn 2 cấp như sohagame.com.vn)
    được gom thành 1 asset group; subdomain thuộc root nào thì vào group đó.
"""
import csv
import io
import re
import unicodedata

from publicsuffix2 import get_sld

DOMAIN_RE = re.compile(
    r"([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d{1,5})?"
)
VALID_HOST_RE = re.compile(
    r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

DOMAIN_HEADER_ALIASES = {"domain", "subdomain", "host", "hostname", "fqdn", "url", "target", "asset"}
PROJECT_HEADER_ALIASES = {"dự án", "du an", "project"}

# Bản ghi DNS kỹ thuật (DKIM/DMARC/ACME...) không phải web asset — loại khỏi danh sách quét
DNS_RECORD_RE = re.compile(r"(^|[._])(_domainkey|_dmarc|_acme-challenge|_amazonses|_autodiscover|_mta-sts)", re.I)


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _norm_header(text: str) -> str:
    return _strip_accents(str(text).strip().lower())


def _sniff_delimiter(first_line: str) -> str:
    if first_line.count("\t") > first_line.count(","):
        return "\t"
    if first_line.count(";") > first_line.count(","):
        return ";"
    return ","


def is_domain_template(content: str) -> bool:
    """True nếu file có header ≥2 cột và có cột domain — đủ điều kiện template mode."""
    first = next((ln for ln in content.splitlines() if ln.strip()), "")
    if not first:
        return False
    try:
        row = next(csv.reader([first], delimiter=_sniff_delimiter(first)))
    except csv.Error:
        return False
    cells = [_norm_header(c) for c in row]
    return len(cells) >= 2 and any(c in DOMAIN_HEADER_ALIASES for c in cells)


def parse(content: str, file_name: str | None = None) -> dict:
    """Parse template domain-list: trả về items (kèm meta) + groups đề xuất."""
    lines = [ln for ln in content.splitlines() if ln.strip()]
    if not lines:
        return {"template": "domain-list", "totalRows": 0, "discoveredTotal": 0,
                "validTotal": 0, "dnsRecordCount": 0, "items": [], "groups": [], "normalizedUrls": []}

    delimiter = _sniff_delimiter(lines[0])
    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return {"template": "domain-list", "totalRows": 0, "discoveredTotal": 0,
                "validTotal": 0, "dnsRecordCount": 0, "items": [], "groups": [], "normalizedUrls": []}

    header_raw = [c.strip() for c in rows[0]]
    header_norm = [_norm_header(c) for c in header_raw]
    domain_idx = next((i for i, c in enumerate(header_norm) if c == "domain"),
                      next((i for i, c in enumerate(header_norm) if c in DOMAIN_HEADER_ALIASES), 0))
    project_idx = next((i for i, c in enumerate(header_norm) if c in PROJECT_HEADER_ALIASES), None)
    meta_cols = [(i, header_raw[i]) for i in range(len(header_raw)) if i != domain_idx]

    items: list[dict] = []
    groups: dict[str, dict] = {}
    seen: set[str] = set()
    dns_record_count = 0

    for row in rows[1:]:
        def cell(idx: int) -> str:
            return row[idx].strip() if idx < len(row) else ""

        raw = cell(domain_idx).strip().lower()
        if not raw:
            continue

        scheme, port = "https", 443
        if raw.startswith("http://"):
            scheme, port = "http", 80
            raw = raw[len("http://"):]
        elif raw.startswith("https://"):
            raw = raw[len("https://"):]
        slash = raw.find("/")
        if slash != -1:
            raw = raw[:slash]
        if ":" in raw:
            host_part, _, port_part = raw.partition(":")
            try:
                p = int(port_part)
                if 0 < p <= 65535:
                    raw, port = host_part, p
                else:
                    raw = host_part
            except ValueError:
                raw = host_part
        # Cell bẩn (chứa ký tự lạ) → thử trích domain bên trong; giữ nguyên
        # host hợp lệ kể cả khi bắt đầu bằng '_' hoặc '*.' (DNS record/wildcard)
        if not re.fullmatch(r"[a-z0-9*._-]+", raw):
            m = DOMAIN_RE.search(raw)
            raw = m.group(0).lower() if m else ""
        if not raw:
            continue
        host = raw
        if host not in seen:
            seen.add(host)

        wildcard = host.startswith("*.")
        scan_host = host[2:] if wildcard else host
        is_dns_record = bool(
            DNS_RECORD_RE.search(scan_host)
            or scan_host.startswith("_")
            or scan_host.endswith(".arpa")
            or ".arpa" in scan_host
        )
        try:
            registrable = get_sld(scan_host) or scan_host
        except Exception:
            registrable = scan_host

        meta: dict[str, str] = {}
        for idx, original_header in meta_cols:
            value = cell(idx)
            if value:
                meta[original_header] = value
        project = cell(project_idx) if project_idx is not None else ""

        items.append({
            "subdomain": host,
            "detectedScheme": scheme,
            "port": port,
            "normalizedUrl": f"{scheme}://{scan_host}{'' if port in (80, 443) else f':{port}'}",
            "isValid": bool(VALID_HOST_RE.match(scan_host)),
            "meta": meta,
            "rootDomain": registrable,
            "isRoot": scan_host == registrable,
            "isDnsRecord": is_dns_record,
            "isWildcard": wildcard,
        })

        g = groups.setdefault(registrable, {
            "name": registrable,
            "rootDomain": registrable,
            "subdomains": [],
            "tags": [],
            "meta": {},
            "hasRootRow": False,
            "dnsRecordCount": 0,
        })
        if is_dns_record:
            g["dnsRecordCount"] += 1
            dns_record_count += 1
        elif scan_host not in g["subdomains"]:
            g["subdomains"].append(scan_host)
        if scan_host == registrable:
            # dòng domain gốc chứa metadata cấp group (email quản lý, phụ trách, note...)
            g["hasRootRow"] = True
            for k, v in meta.items():
                if v and k not in g["meta"]:
                    g["meta"][k] = v
        if project and project not in g["tags"]:
            g["tags"].append(project)

    group_list = []
    for g in groups.values():
        has_root = g.pop("hasRootRow")
        group_list.append({
            **g,
            "assetCount": len(g["subdomains"]),
            "hasRootRow": has_root,
        })

    valid_items = [i for i in items if i["isValid"] and not i["isDnsRecord"]]
    return {
        "fileName": file_name or "import_domains.csv",
        "template": "domain-list",
        "totalRows": len(rows) - 1,
        "discoveredTotal": len(items),
        "validTotal": len(valid_items),
        "dnsRecordCount": dns_record_count,
        "items": items,
        "groups": group_list,
        "normalizedUrls": [i["normalizedUrl"] for i in valid_items],
    }
