"""
Fingerprint rules phát hiện công nghệ từ HTTP response.
Port từ TECH_RULES của frontend/server.ts, bổ sung thêm các tech
thường bị nhắm bởi CVE (Tomcat, Jenkins, Drupal, Joomla, Grafana...).

Mỗi rule:
  name      : tên hiển thị
  category  : Frontend | Framework | UI Library | CMS | Web Server | CDN |
              Language | Analytics | Security | DevOps
  color     : màu hex cho UI
  headers   : [(header_key, match_regex, version_group)]  -- group None = không trích version
  html      : [(regex, version_group)]
  scripts   : [regex]
Version group là index của capture group chứa phiên bản (theo match() của re).
"""
import re


class Rule:
    __slots__ = ("name", "category", "color", "headers", "html", "scripts")

    def __init__(self, name, category, color, headers=None, html=None, scripts=None):
        self.name = name
        self.category = category
        self.color = color
        self.headers = headers or []
        self.html = html or []
        self.scripts = scripts or []


def _c(pattern, *, flags=re.IGNORECASE):
    return re.compile(pattern, flags)


RULES = [
    # ---- UI Frameworks & Libraries ----
    Rule("Vue.js", "Framework", "#42b883",
         html=[_c(r"data-v-[a-z0-9]+"), _c(r'id="__vue-app"'), _c(r"vue-component")],
         scripts=[_c(r"vue(\.runtime)?(\.min)?\.js"), _c(r"vue@[\d.]+"), _c(r"@vue/")]),
    Rule("Quasar", "UI Library", "#1976d2",
         html=[_c(r'class="[^"]*q-(app|layout|header|drawer|page|btn|card|table)[^"]*"'), _c(r"data-quasar")],
         scripts=[_c(r"quasar(\.umd)?(\.min)?\.js"), _c(r"quasar@")]),
    Rule("Nuxt.js", "Framework", "#00dc82",
         headers=[("x-powered-by", _c(r"Nuxt"), None)],
         html=[_c(r'<div id="__nuxt"'), _c(r"__NUXT__"), _c(r"data-n-head")],
         scripts=[_c(r"_nuxt/")]),
    Rule("React", "Framework", "#61dafb",
         html=[_c(r"data-reactroot"), _c(r"data-reactid"), _c(r"_reactFiber"), _c(r"__NEXT_DATA__")],
         scripts=[_c(r"react(\.production)?(\.min)?\.js"), _c(r"react-dom")]),
    Rule("Next.js", "Framework", "#000000",
         headers=[("x-powered-by", _c(r"Next\.js"), None)],
         html=[_c(r'<script id="__NEXT_DATA__"'), _c(r"next-route-announcer")],
         scripts=[_c(r"_next/static/")]),
    Rule("Angular", "Framework", "#dd0031",
         html=[_c(r"ng-version="), _c(r"ng-app"), _c(r"ng-binding")],
         scripts=[_c(r"angular(\.min)?\.js"), _c(r"runtime-es2015")]),
    Rule("Tailwind CSS", "UI Library", "#38bdf8",
         html=[_c(r"\b(grid-cols-|flex-col|items-center|justify-between|bg-(slate|zinc|neutral|emerald|sky|indigo)-)\b")]),
    Rule("Bootstrap", "UI Library", "#7952b3",
         html=[_c(r"\b(container-fluid|navbar-expand|col-(xs|sm|md|lg|xl)-|btn-(primary|secondary|danger))\b")],
         scripts=[_c(r"bootstrap(\.bundle)?(\.min)?\.js")]),
    Rule("jQuery", "Frontend", "#0769ad",
         html=[(_c(r"jquery-([\d.]+)(\.min)?\.js"), 1)],
         scripts=[_c(r"jquery(-[\d.]+)?(\.min)?\.js"), _c(r"code\.jquery\.com")]),

    # ---- CMS ----
    Rule("WordPress", "CMS", "#21759b",
         headers=[("x-powered-by", _c(r"wp"), None)],
         html=[(_c(r'<meta name="generator" content="WordPress/?\s?([\d.]+)"'), 1),
               _c(r"wp-content/(themes|plugins)"), _c(r"wp-includes/")]),
    Rule("Shopify", "CMS", "#96bf48",
         headers=[("x-shopid", _c(r".+"), None)],
         html=[_c(r"cdn\.shopify\.com"), _c(r"Shopify\.theme")]),
    Rule("Ghost", "CMS", "#738a94",
         headers=[("x-powered-by", _c(r"Ghost"), None)],
         html=[_c(r'<meta name="generator" content="Ghost')]),
    Rule("Drupal", "CMS", "#0678be",
         html=[(_c(r'<meta name="generator" content="Drupal ([\d.]+)"'), 1),
               _c(r"sites/default/files"), _c(r"drupal\.js"), _c(r"/core/assets/")]),
    Rule("Joomla", "CMS", "#f9a541",
         html=[(_c(r'<meta name="generator" content="Joomla!?/?\s?([\d.]+)"'), 1),
               _c(r"/media/jui/"), _c(r"/components/com_")]),
    Rule("WHMCS", "CMS", "#2b3990",
         html=[_c(r"whmcs"), _c(r"/assets/img/whmcs")]),

    # ---- Web Servers & Reverse Proxies ----
    Rule("Nginx", "Web Server", "#009639",
         headers=[("server", _c(r"nginx(?:/?([\d.]+))?"), 1)]),
    Rule("Apache", "Web Server", "#d22128",
         headers=[("server", _c(r"apache(?:/?([\d.]+))?"), 1)]),
    Rule("Microsoft-IIS", "Web Server", "#0078d7",
         headers=[("server", _c(r"Microsoft-IIS(?:/?([\d.]+))?"), 1)]),
    Rule("LiteSpeed", "Web Server", "#0066cc",
         headers=[("server", _c(r"LiteSpeed"), None)]),
    Rule("Apache Tomcat", "Web Server", "#f8dc46",
         headers=[("server", _c(r"tomcat/?([\d.]+)"), 1)],
         html=[(_c(r"<title>Apache Tomcat/([\d.]+)"), 1)]),

    # ---- CDN ----
    Rule("Cloudflare", "CDN", "#f38020",
         headers=[("server", _c(r"cloudflare"), None),
                  ("cf-ray", _c(r".+"), None),
                  ("cf-cache-status", _c(r".+"), None)]),
    Rule("Amazon CloudFront", "CDN", "#ff9900",
         headers=[("via", _c(r"CloudFront"), None),
                  ("x-amz-cf-id", _c(r".+"), None)]),

    # ---- DevOps / Hosting ----
    Rule("Vercel", "DevOps", "#000000",
         headers=[("server", _c(r"vercel"), None), ("x-vercel-id", _c(r".+"), None)]),
    Rule("Netlify", "DevOps", "#00c7b7",
         headers=[("server", _c(r"Netlify"), None), ("x-nf-request-id", _c(r".+"), None)]),

    # ---- Backend Languages & Frameworks ----
    Rule("PHP", "Language", "#777bb4",
         headers=[("x-powered-by", _c(r"PHP/([\d.]+)"), 1),
                  ("set-cookie", _c(r"PHPSESSID"), None)]),
    Rule("Express / Node.js", "Language", "#68a063",
         headers=[("x-powered-by", _c(r"Express"), None)]),
    Rule("ASP.NET", "Framework", "#512bd4",
         headers=[("x-powered-by", _c(r"ASP\.NET"), None),
                  ("x-aspnet-version", _c(r"([\d.]+)"), 1),
                  ("set-cookie", _c(r"ASP\.NET_SessionId"), None)]),

    # ---- CI/CD & Monitoring (mục tiêu CVE phổ biến) ----
    Rule("Jenkins", "DevOps", "#d33833",
         headers=[("x-jenkins", _c(r"([\d.]+)"), 1),
                  ("x-jenkins-session", _c(r".+"), None)]),
    Rule("Grafana", "DevOps", "#f46800",
         headers=[("set-cookie", _c(r"grafana_session"), None)],
         html=[_c(r"grafana"), _c(r"<title>Grafana</title>")]),

    # ---- Analytics & Security ----
    Rule("Google Analytics", "Analytics", "#e37400",
         scripts=[_c(r"google-analytics\.com/(analytics|ga)\.js"), _c(r"googletagmanager\.com/gtag/js")]),
    Rule("Google Tag Manager", "Analytics", "#4285f4",
         scripts=[_c(r"googletagmanager\.com/gtm\.js")]),
    Rule("Sentry", "DevOps", "#362d59",
         scripts=[_c(r"browser\.sentry-cdn\.com"), _c(r"@sentry/")]),
]


def detect_technologies(headers: dict, body: str) -> list:
    """
    Trả về list dict {name, category, version?, color}.
    Thứ tự ưu tiên mỗi rule: headers -> html -> scripts.
    """
    detected = []
    seen = set()
    lower_headers = {k.lower(): v for k, v in headers.items()}

    for rule in RULES:
        matched = False
        version = None

        for key, pattern, vg in rule.headers:
            value = lower_headers.get(key.lower())
            if not value:
                continue
            m = pattern.search(value)
            if m:
                matched = True
                if vg and m.group(vg):
                    version = m.group(vg)
                break

        if not matched and body:
            for item in rule.html:
                pattern, vg = item if isinstance(item, tuple) else (item, None)
                m = pattern.search(body)
                if m:
                    matched = True
                    if vg and m.group(vg):
                        version = m.group(vg)
                    break
            if not matched:
                for pattern in rule.scripts:
                    if pattern.search(body):
                        matched = True
                        break

        if matched and rule.name not in seen:
            seen.add(rule.name)
            item = {"name": rule.name, "category": rule.category, "color": rule.color}
            if version:
                item["version"] = version
            detected.append(item)

    return detected
