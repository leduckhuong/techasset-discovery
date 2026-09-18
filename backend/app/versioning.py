"""
So khớp phiên bản & chuẩn hoá tên phần mềm.
Port từ frontend/src/utils/cveMatcher.ts giữ nguyên ngữ nghĩa, để cảnh báo
tạo ra từ backend nhất quán với logic hiển thị của frontend.
"""
import re

_NUM_RE = re.compile(r"[^0-9.]")


def compare_versions(v1: str, v2: str) -> int:
    """So sánh 2 chuỗi phiên bản dạng số. Trả về -1 / 0 / 1."""
    clean1 = [int(x) for x in _NUM_RE.sub("", v1).split(".") if x != ""]
    clean2 = [int(x) for x in _NUM_RE.sub("", v2).split(".") if x != ""]
    for i in range(max(len(clean1), len(clean2))):
        n1 = clean1[i] if i < len(clean1) else 0
        n2 = clean2[i] if i < len(clean2) else 0
        if n1 < n2:
            return -1
        if n1 > n2:
            return 1
    return 0


def is_version_affected(detected_ver: str, rule: str) -> bool:
    """
    Kiểm tra phiên bản phát hiện được có nằm trong dải bị ảnh hưởng của CVE không.
    Hỗ trợ: "< 2.4.56", "<= 6.4.2", "> 1.0", ">= 1.0", "= 8.1.2",
    "8.1.0 - 8.1.28", "8.1.0 to 8.1.28", "*", "all", "any", hoặc bản exact.
    """
    if not detected_ver:
        return False
    d_ver = detected_ver.strip()
    r = rule.strip()
    low = r.lower()

    if r == "*" or low in ("all", "any"):
        return True

    # Dải: "2.4.0 - 2.4.55" hoặc "8.1.0 to 8.1.28"
    if " - " in r or " to " in low:
        parts = re.split(r"\s+-\s+|\s+to\s+", r, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2:
            return compare_versions(d_ver, parts[0].strip()) >= 0 and compare_versions(
                d_ver, parts[1].strip()
            ) <= 0

    if r.startswith("<="):
        return compare_versions(d_ver, r[2:].strip()) <= 0
    if r.startswith("<"):
        return compare_versions(d_ver, r[1:].strip()) < 0
    if r.startswith(">="):
        return compare_versions(d_ver, r[2:].strip()) >= 0
    if r.startswith(">"):
        return compare_versions(d_ver, r[1:].strip()) > 0
    if r.startswith("="):
        return compare_versions(d_ver, r[1:].strip()) == 0

    # Exact hoặc prefix (ví dụ bot đẩy "2.4" nghĩa là mọi bản 2.4.x)
    return compare_versions(d_ver, r) == 0 or d_ver.startswith(r)


_ALIASES = {
    "apache http server": "apache",
    "httpd": "apache",
    "microsoft-iis": "iis",
    "iis": "iis",
    "nodejs": "node.js",
    "node.js": "node.js",
    "node": "node.js",
    "express": "express",
    "vuejs": "vue.js",
    "vue.js": "vue.js",
    "apache tomcat": "tomcat",
    "tomcat": "tomcat",
}


def normalize_software_name(name: str) -> str:
    """Chuẩn hoá tên phần mềm để so khớp ("Apache HTTP Server" -> "apache")."""
    lower = name.lower().strip()
    if lower in _ALIASES:
        return _ALIASES[lower]
    for needle, alias in (
        ("apache", "apache"),
        ("nginx", "nginx"),
        ("wordpress", "wordpress"),
        ("php", "php"),
        ("tomcat", "tomcat"),
        ("jenkins", "jenkins"),
        ("drupal", "drupal"),
        ("joomla", "joomla"),
        ("grafana", "grafana"),
        ("gitlab", "gitlab"),
        ("vue", "vue.js"),
        ("quasar", "quasar"),
        ("jquery", "jquery"),
        ("bootstrap", "bootstrap"),
        ("openssl", "openssl"),
        ("iis", "iis"),
        ("node", "node.js"),
        ("next.js", "next.js"),
        ("nuxt", "nuxt.js"),
    ):
        if needle in lower:
            return alias
    return lower


def software_matches(tech_name: str, cve_software: str) -> bool:
    """
    Tên tech trên asset có khớp software trong CVE không.
    So khớp sau chuẩn hoá, kèm substring 2 chiều như engine của frontend.
    """
    t = normalize_software_name(tech_name)
    c = normalize_software_name(cve_software)
    if not t or not c:
        return False
    return t == c or t in c or c in t


def version_from_server_header(header_value: str) -> str:
    """Trích phiên bản từ chuỗi Server header, ví dụ "Apache/2.4.52 (Ubuntu)" -> "2.4.52"."""
    m = re.search(r"[\d.]+", header_value or "")
    return m.group(0) if m else ""
