# TechAsset Discovery — Backend

Backend FastAPI cho app quét tech stack theo subdomain/URL, nhận CVE từ bot ngoài
qua webhook, và tự động cảnh báo khi công nghệ phát hiện được trên asset rơi vào
dải phiên bản bị ảnh hưởng của CVE.

## Tính năng

- **Quét tech theo subdomain**: fetch HTTP(S), phân tích Server header,
  `X-Powered-By`, meta generator, script paths, cookies... để fingerprint
  công nghệ + phiên bản (WordPress, Apache, Nginx, PHP, jQuery, Tomcat,
  Jenkins, Drupal...).
- **Webhook nhận CVE cho bot**: `POST /api/cve/push` — bot đẩy CVE kèm dải
  version bị ảnh hưởng; app so khớp ngay với toàn bộ asset và sinh alert.
- **Cảnh báo (alerts)**: một alert mỗi cặp (CVE, asset); giữ nguyên trạng thái
  triage (`active/investigating/resolved`) khi CVE được đẩy lại; tự gỡ khi
  rescan thấy asset đã vá hoặc asset bị xóa.
- **Lưu trữ SQLite** (`data/techasset.db`) — dữ liệu sống qua restart.
- **Cron job quét định kỳ thật** (APScheduler): job lưu DB, tự nạp lại khi
  khởi động, chạy quét nền theo lịch, timezone mặc định `Asia/Ho_Chi_Minh`.
- **SSL cert thật**: đọc issuer/commonName/ngày hết hạn từ chứng chỉ của host.
- **Import CSV subdomain** + **dò subdomain từ crt.sh** (`/api/discover-subdomains`).

## Cài đặt & chạy

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# (tuỳ chọn) cấu hình: cp .env.example .env
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Swagger UI: http://localhost:8000/docs

## Nuclei tech-detection (-nuclei)

Ngoài fingerprint header/body, scanner có thể chạy thêm **nuclei** với
`-tags tech,discovery` để nhận diện sâu hơn (WAF, phiên bản TLS lỗi thời,
phần mềm EOL, wappalyzer technology set ~2000+ chữ ký...):

- Bật theo request: `POST /api/scan-single {"url": "...", "nuclei": true}`
  hoặc cờ `-nuclei (Tech sâu)` trên UI. Bulk `/api/scan`: `options.nuclei`.
- Cần binary `nuclei` trong PATH + templates (`nuclei -update-templates`).
  Thiếu binary → tự bỏ qua, scan vẫn chạy bình thường.
- Kết quả merge vào `technologies` của asset với `source: "nuclei"`,
  kèm `templateId`; các phát hiện cùng template gom version lại với nhau
  (VD: `TLS Version - Detect: tls10, tls11, tls12`).
- Cấu hình (`backend/.env`): `NUCLEI_TAGS` (mặc định `tech,discovery`),
  `NUCLEI_TIMEOUT` (180s), `NUCLEI_CONCURRENCY` (50), `NUCLEI_RATE_LIMIT` (250).
- Lưu ý hiệu năng: 1 target tốn thêm ~30s-2ph30s; khi bật nuclei, bulk scan
  tự giới hạn 4 target song song. health endpoint báo `nuclei: true/false`.

## Dò web port bằng httpx

`POST /api/probe-ports` — dò các web port phổ biến trên danh sách host:

```json
{ "hosts": ["sub.domain.vn", "other.domain.vn"], "ports": "80,443,8080", "assetGroupId": "group-xxx" }
```

- `ports` bỏ trống → dùng **79 web ports mặc định** (80, 443, 8080, 8443, 9090, 8000, 7000, 10000...)
- Service tìm thấy được **lưu thẳng vào assets** (status/title/webserver/tech kèm
  version từ wappalyzer của httpx, `source: "httpx"`) + chạy CVE agent ngay
- Cần binary `httpx` trong PATH (tương tự subfinder)
- Cấu hình: `HTTPX_TIMEOUT` (600s), `HTTPX_THREADS` (50)
- Trong Docker image: httpx đã cài sẵn

## Docker

Image all-in-one (backend + nuclei + subfinder + httpx + frontend build) — xem
`docker-compose.yml` ở thư mục gốc:

```bash
docker compose up -d --build
```

- Dashboard + API tại `http://localhost:8000`
- DB bền vững: `./backend/data` (bind mount)
- Nuclei templates: mount `${HOME}/nuclei-templates`
- `network_mode: host` — quét ra ngoài bằng đúng IP/VPN của máy

## Tích hợp con bot đẩy CVE

Webhook: **`POST /api/cve/push`** (`Content-Type: application/json`)

### Template CSV cố định (List domain VCCORP)

Import CSV nhận diện tự động 2 chế độ:

1. **Template "domain list"** (header có cột `DOMAIN` + ≥1 cột khác): toàn bộ
   cột metadata (DỰ ÁN, EMAIL SẼ QUẢN LÝ DOMAIN, TRẠNG THÁI CHUYỂN, NOTE,
   NGƯỜI PHỤ TRÁCH, PROJECT, STATUS...) được **giữ nguyên** và gắn vào
   asset + asset group. Mỗi **domain gốc (eTLD+1)** — xử lý đúng `.vn` 2 cấp
   như `sohagame.com.vn` — trở thành **1 asset group**; dòng của domain gốc
   cung cấp metadata cấp group. Bản ghi DNS kỹ thuật (`_domainkey`, `_dmarc`,
   `_acme-challenge`, `*.arpa`...) được đánh dấu và **loại khỏi quét tech**.
   Mẫu: `tests/template_mau.csv`.

2. **Danh sách subdomain thuần** (1 cột): hành vi cũ, parse + chuẩn hoá.

`POST /api/parse-csv` trả thêm `template`, `groups` (đề xuất asset group),
`dnsRecordCount`; mỗi item có `meta`, `rootDomain`, `isRoot`, `isDnsRecord`,
`isWildcard`. Khi quét (`/api/scan-single`, `/api/scan`) có thể truyền thêm
`meta` (dict) và `assetGroupId` — được lưu vào asset và trả về trong
`GET /api/assets`.

## Dò subdomain theo domain (subfinder)

`POST /api/discover-subdomains` `{"rootDomain": "bizfly.vn", "engine": "auto|subfinder|crtsh"}`

- `subfinder` (khuyến nghị): passive enumeration 40+ nguồn. Cần binary
  `subfinder` trong PATH (`go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest`
  hoặc `sudo apt install subfinder`). Timeout mặc định 180s (`SUBFINDER_TIMEOUT`).
- `crt.sh`: chỉ certificate transparency, không cần binary.
- `auto` (mặc định): dùng subfinder nếu có, lỗi/không có thì fallback crt.sh.

Kết quả gộp vào asset group bằng `PATCH /api/asset-groups/{id}` (`subdomains`).

### So sánh nhanh các engine dò sub

| Engine       | Loại            | Tốc độ       | Độ phủ              | Khi nào dùng                     |
| ------------ | --------------- | ------------ | ------------------- | -------------------------------- |
| **subfinder**| Passive, 40+ nguồn | Nhanh (30-90s/domain) | Cao với API key (VT, SecurityTrails...) | **Mặc định** — bulk hàng trăm domain |
| crt.sh       | Chỉ CT log      | Trung bình, hay quá tải | Thấp (chỉ cert)   | Fallback không cần binary        |
| amass        | Passive + active| Chậm (phút-giờ/domain) | Rất cao, nhiều OSINT | Audit sâu 1-2 domain quan trọng |
| puredns/massdns | Active brute-force | Phụ thuộc wordlist + resolver | Tìm sub ẩn, gây traffic | Giai đoạn 2 khi passive đã cạn |

### Webhook: `POST /api/cve/push` (`Content-Type: application/json`)

| Field              | Bắt buộc | Ví dụ                  | Ghi chú                                   |
| ------------------ | -------- | ---------------------- | ----------------------------------------- |
| `cveId`            | ✅       | `CVE-2023-25690`       | trùng `cveId` sẽ ghi đè (upsert)          |
| `software`         | ✅       | `Apache`               | tên phần mềm, so khớp không phân biệt hoa/thường |
| `affectedVersions` | ✅       | `< 2.4.56`             | hỗ trợ `<`, `<=`, `>`, `>=`, `=`, `8.1.0 - 8.1.28`, `*` |
| `severity`         |          | `CRITICAL`             | CRITICAL/HIGH/MEDIUM/LOW (tự suy từ CVSS nếu bỏ trống) |
| `cvssScore`        |          | `9.8`                  |                                           |
| `summary`          |          | mô tả lỗ hổng          | hiển thị trong alert                      |
| `remediation`      |          | hướng dẫn khắc phục    |                                           |
| `source`           |          | `Telegram Alert Bot`   | tên nguồn bot                             |

```bash
curl -X POST http://localhost:8000/api/cve/push \
  -H "Content-Type: application/json" \
  -d '{"cveId":"CVE-2021-41773","software":"Apache","affectedVersions":"< 2.4.50","severity":"CRITICAL","cvssScore":9.8,"summary":"Path Traversal & RCE","source":"Telegram Alert Bot"}'
```

Response trả về `matchedCount`, `matchedAssets` và `alertsCreated` — bot có thể
dùng ngay để bắn thông báo ra Telegram/Discord.

**API key**: nếu set `CVE_PUSH_API_KEY` trong `.env`, bot phải gửi header
`X-API-Key: <giá trị>` trên mỗi request push.

Python example cho bot:

```python
import requests
requests.post("http://localhost:8000/api/cve/push", json={
    "cveId": "CVE-2021-41773",
    "software": "Apache",
    "affectedVersions": "< 2.4.50",
    "severity": "CRITICAL",
    "cvssScore": 9.8,
    "summary": "Path Traversal & RCE in mod_proxy",
    "source": "Telegram Alert Bot",
})
```

## Danh sách endpoint

| Method | Path                     | Chức năng                                        |
| ------ | ------------------------ | ------------------------------------------------ |
| GET    | `/api/health`            | Trạng thái server                                 |
| GET    | `/api/presets`           | Danh sách target mẫu                              |
| POST   | `/api/scan-single`       | Quét 1 URL/subdomain → ScanResult (tự lưu)        |
| POST   | `/api/scan`              | Quét hàng loạt `{urls, options}`                  |
| POST   | `/api/parse-csv`         | Parse CSV subdomain → preview chuẩn hoá           |
| GET    | `/api/assets`            | Danh sách asset đã quét                           |
| POST   | `/api/assets`            | Upsert asset thủ công                             |
| DELETE | `/api/assets/{id}`       | Xóa asset (+ alerts liên quan)                    |
| GET/POST | `/api/asset-groups`    | Quản lý nhóm asset theo root domain               |
| GET/POST | `/api/cron-jobs`       | Xem / tạo lịch quét định kỳ                       |
| PATCH/DELETE | `/api/cron-jobs/{id}` | Sửa (enable/disable) / xóa lịch                 |
| POST   | `/api/cron-jobs/{id}/run`| Chạy lịch ngay (sync, trả về results)             |
| GET    | `/api/cve/list`          | Danh sách CVE đã nạp                              |
| POST   | `/api/cve/push`          | **Webhook bot đẩy CVE**                           |
| GET    | `/api/cve/alerts`        | Danh sách cảnh báo (filter `?status=&severity=`)  |
| PATCH  | `/api/cve/alerts/{id}`   | Đổi trạng thái cảnh báo                           |
| POST   | `/api/cve/agent/run`     | Chạy lại agent so khớp toàn bộ                    |
| GET    | `/api/cve/bot-webhook-info` | Info webhook + curl mẫu                        |
| POST   | `/api/discover-subdomains` | Dò subdomain từ certificate transparency (crt.sh) |

## Test offline

```bash
# mock site WordPress + Apache 2.4.49 + PHP 7.4 (cổ 8099)
.venv/bin/python tests/mock_target.py 8099

# quét mock → đẩy CVE → xem alert
curl -X POST localhost:8000/api/scan-single -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:8099"}'
curl -X POST localhost:8000/api/cve/push -H "Content-Type: application/json" \
  -d '{"cveId":"CVE-2021-41773","software":"Apache","affectedVersions":"< 2.4.50","severity":"CRITICAL"}'
curl localhost:8000/api/cve/alerts
```

## Kiến trúc code

```
app/
  main.py        FastAPI routes (toàn bộ /api/*)
  scanner.py     Fetch + DNS + SSL + gọi fingerprint
  tech_rules.py  Rules fingerprint công nghệ (regex headers/html/scripts)
  cve_engine.py  So khớp CVE ↔ asset, sinh/quản lý alert
  versioning.py  So sánh version + dải affected ("< 2.4.56", "8.1.0 - 8.1.28"...)
  scheduler.py   APScheduler cron job quét định kỳ
  inventory.py   Upsert asset vào DB
  db.py          SQLite schema + serializers (camelCase khớp frontend)
  config.py      Env config (.env)
```
