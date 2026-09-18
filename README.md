# TechAsset Discovery

Công cụ **khám phá & quản lý tài sản số (ASM)** cho đội ngũ security: import danh sách domain theo template CSV, dò subdomain bằng subfinder, quét tech stack (httpx fingerprint + nuclei), nhận CVE từ bot ngoài qua webhook và tự động cảnh báo asset bị ảnh hưởng.

Giao diện lấy cảm hứng từ [ProjectDiscovery Cloud](https://cloud.projectdiscovery.io) — facet tabs, filter builder, terminal scan thời gian thực.

## Tính năng

- **Import CSV template cố định**: cột `DOMAIN` + mọi cột metadata (DỰ ÁN, EMAIL, TRẠNG THÁI, NOTE, NGƯỜI PHỤ TRÁCH...) đều được giữ lại; mỗi domain gốc (eTLD+1, đúng cả `.vn` 2 cấp) tự tạo 1 asset group
- **Dò subdomain**: subfinder (passive, 40+ nguồn — API keys qua provider-config.yaml) hoặc crt.sh fallback
- **Quét tech stack**: fingerprint riêng (Server header, X-Powered-By, meta generator, script paths...) + **nuclei** `-tags tech,discovery` (wappalyzer set, WAF, TLS cũ, EOL...)
- **Quét port web**: httpx dò 79 web ports phổ biến, service tìm thấy tự thành asset
- **CVE webhook cho bot**: `POST /api/cve/push` — agent tự so khớp CVE với tech/version trên từng asset và sinh cảnh báo
- **Cron quét định kỳ**: APScheduler, timezone Asia/Ho_Chi_Minh
- **SSL cert thật** (issuer/expiry), redirect chain, ASN, labels tự động
- **Dashboard**: facet tabs kiểu PD Cloud (Technologies/Ports/Labels/Domains), Add Filters với value counts, terminal log append-only

## Kiến trúc

```
backend/   FastAPI + SQLite + APScheduler — API, scanner, engines (nuclei/subfinder/httpx), CVE agent
frontend/  React + Vite + Tailwind — dashboard
```

## Chạy bằng Docker (khuyến nghị)

Image all-in-one: backend + nuclei + subfinder + httpx + frontend đã build.

```bash
docker compose up -d --build
# mở http://localhost:8000
```

- DB SQLite bền vững tại `./backend/data` (bind mount)
- Nuclei templates + subfinder API keys mount từ `$HOME`
- Đổi port: tạo `.env` cạnh `docker-compose.yml` với `PORT=8787`
- `network_mode: host` — quét ra ngoài bằng đúng source IP/VPN của máy

## Chạy thủ công (dev)

```bash
# Backend (yêu cầu nuclei + subfinder binary trong PATH)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# Frontend (terminal khác)
cd frontend && npm install && npm run dev   # tự proxy /api → :8000
```

## Import CSV & pipeline quét

Template: cột đầu là `DOMAIN`, các cột còn lại là metadata (tự nhận diện DỰ ÁN/PROJECT, STATUS, EMAIL, NOTE, NGƯỜI PHỤ TRÁCH...). Mẫu: `backend/tests/template_mau.csv`.

Trong modal Import có thể bật/tắt từng giai đoạn:
1. **Dò subdomain** (subfinder) theo domain gốc — sub mới merge vào group
2. **Quét Tech Stack** từng mục tiêu (+ nuclei nếu bật)
3. **Quét port** (httpx) — service tìm thấy tự thêm vào group

Pipeline chạy nền trên server — đóng tab không ảnh hưởng.

## Webhook CVE cho bot

```bash
curl -X POST http://localhost:8000/api/cve/push -H "Content-Type: application/json" \
  -d '{"cveId":"CVE-2021-41773","software":"Apache","affectedVersions":"< 2.4.50","severity":"CRITICAL","cvssScore":9.8,"summary":"Path Traversal RCE","source":"Telegram Bot"}'
```

Response trả `matchedCount` + `matchedAssets` + `alertsCreated` để bot bắn notify. Bật API key qua `CVE_PUSH_API_KEY` trong `backend/.env` (header `X-API-Key`). Chi tiết: [backend/README.md](backend/README.md).

## Bảo mật

- App bind `0.0.0.0` — khi deploy VPS công khai, giới hạn bằng firewall (`ufw allow from <IP> to any port 8787`)
- Bật `CVE_PUSH_API_KEY` cho webhook push CVE
- `.env`, DB, API keys nằm ngoài git (xem `.gitignore`)

## API

Swagger UI: `/docs` khi chạy backend. Danh sách đầy đủ + ví dụ: [backend/README.md](backend/README.md).
