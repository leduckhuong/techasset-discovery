"""
Mock target server để test/demo scanner offline.
Chạy: python3 tests/mock_target.py [port]   (mặc định 8099)
Giả lập một site WordPress + Apache 2.4.49 + PHP 7.4 cũ (dính CVE-2021-41773).
"""
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

HTML = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta name="generator" content="WordPress 6.4.0">
  <title>Trang test TechAsset Scanner</title>
  <script src="/wp-includes/js/jquery/jquery-3.6.0.min.js"></script>
  <script src="/wp-content/themes/twentytwentyfour/script.js"></script>
</head>
<body><div class="container-fluid"><h1>Mock WordPress Site</h1></div></body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def version_string(self):
        return "Apache/2.4.49 (Unix)"

    def do_GET(self):
        self.send_response(200)
        self.send_header("X-Powered-By", "PHP/7.4.30")
        self.send_header("Content-Type", "text/html; charset=UTF-8")
        self.send_header("Content-Length", str(len(HTML)))
        self.send_header("Set-Cookie", "PHPSESSID=abc123; path=/")
        self.end_headers()
        self.wfile.write(HTML.encode())

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    print(f"Mock target running on http://localhost:{port}")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
