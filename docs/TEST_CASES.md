# TechAsset Discovery — Test Cases & Kết quả kiểm thử

Ngày kiểm thử: 2026-09-23 · Môi trường: backend local (port 8000) + VPS production (8787)
Phương thức: test suite API tự động (`/tmp/test_suite.py`) + kiểm thử UI qua PLR browser (Firefox)

## I. Test suite API — 22/22 PASS

| ID | Chức năng | Steps | Expected | Kết quả |
|----|-----------|-------|----------|---------|
| TC01 | Health check | GET /api/health | 200, status ok, nuclei+subfinder+httpx đều true | ✅ PASS |
| TC02 | Auth middleware | GET /api/assets không kèm xác thực | 401 Unauthorized | ✅ PASS |
| TC03 | API key bot | GET /api/assets với X-API-Key | 200 + tổng assets | ✅ PASS |
| TC04 | Login sai mật khẩu | POST /login (pass sai) | Redirect về /login kèm error | ✅ PASS |
| TC05 | Login đúng | POST /login (user+pass+TOTP) | Session cookie `ta_session`, gọi API admin được | ✅ PASS |
| TC06 | Tạo workspace | POST /api/workspaces + GET assets scoped | Inventory workspace mới = 0 | ✅ PASS |
| TC07 | Tạo group tên tuỳ ý | POST /api/asset-groups (name + rootDomain + 2 subdomain) | 200, name giữ nguyên, 2 subs | ✅ PASS |
| TC08 | Sub mới → asset | GET assets theo workspace sau khi tạo group | 3 asset "Chưa quét" (statusCode=0), đúng group + workspace | ✅ PASS |
| TC09 | Đổi tên group | PATCH /api/asset-groups/{id} | 200, name cập nhật | ✅ PASS |
| TC10 | Groups scoped | GET /api/asset-groups?workspace=ws-test | Chỉ group của workspace đó | ✅ PASS |
| TC11 | Scan single | POST /api/scan-single (URL local) | statusCode 200, đúng workspace | ✅ PASS |
| TC11b | Bắt version từ header | Scan server giả `Server: nginx/1.24.0` | webServer = nginx/1.24.0 | ✅ PASS |
| TC12 | Webhook push CVE | POST /api/cve/push (X-API-Key) | 200 success, CVE vào kho | ✅ PASS |
| TC13 | Dedup CVE | Push trùng 2 lần | Tổng kho không tăng | ✅ PASS |
| TC14 | Agent so khớp version | CVE nginx `< 1.25.0` vs asset nginx/1.24.0 | Alert tạo với detectedVersion 1.24.0 | ✅ PASS |
| TC15 | Triage alert | PATCH status → resolved | 200, status cập nhật | ✅ PASS |
| TC16 | Import CVE bằng text | POST /api/cve/import-text | found ≥ 1, imported ≥ 1 (AGI parse) | ✅ PASS |
| TC17 | Telegram status | GET /api/telegram/status + user-session/status | Đủ trường running/configured | ✅ PASS |
| TC18 | Chống wipe secret | PUT settings với value rỗng | Key bị giữ nguyên (kept) | ✅ PASS |
| TC19 | Import pipeline nền | POST /api/import-scan (2 URL) → poll job | job done, assets đúng workspace | ✅ PASS |
| TC20 | SPA + redirect | GET / có auth và không auth | 200 HTML khi auth, 303 → /login khi không | ✅ PASS |
| TC21 | Validate rootDomain | POST group với domain sai định dạng | 400 | ✅ PASS |

## II. Kiểm thử UI (PLR browser) — đã xác minh trong phiên

| ID | Chức năng | Steps | Expected | Kết quả |
|----|-----------|-------|----------|---------|
| UI01 | Badge số liệu đúng | Đổi workspace test ↔ default | test = 0/0, default = 413/12 (không còn mock 637) | ✅ PASS (đã fix hardcode 637) |
| UI02 | Tạo group từ UI | Create → New Asset Group → điền form → Tạo | Group xuất hiện (badge +1), asset "Chưa quét" tự sinh | ✅ PASS |
| UI03 | Đổi tên từ UI | Group view → ✏️ → nhập tên mới → Lưu | Tiêu đề cập nhật ngay | ✅ PASS |
| UI04 | Kho CVE dùng chung | Sidebar → Kho CVE | Danh sách CVE + stats + lọc severity | ✅ PASS |
| UI05 | Dán tin nhắn CVE | Nút Dán tin → paste text → Import | Toast kết quả, CVE vào kho | ✅ PASS |
| UI06 | Group detail khớp card | Bấm group (shg.vn 286 / maoristudio 7) | Data tab = đúng số asset liên kết | ✅ PASS (fix root-domain fallback) |
| UI07 | Facet Technologies | Tab Technologies trong group | Bảng tech + số services | ✅ PASS |
| UI08 | Settings hiển thị | Mở trang Cấu hình | Secret masked "để trống là giữ nguyên", giá trị đúng | ✅ PASS |
| UI09 | CVE Agent view | Mở Cảnh Báo CVE | Alert CVE-2024-9474 hiển thị đúng asset | ✅ PASS |
| UI10 | Console sạch | Toàn phiên duyệt | 0 error/exception JS | ✅ PASS |

## III. Bug phát hiện trong đợt kiểm thử (đã sửa)

| # | Mức độ | Bug | Fix |
|---|--------|-----|-----|
| 1 | **Trung bình** | `/api/cve/agent/run` và `POST /api/assets` dùng `len()` trên **tuple** trả về của `run_agent` → `totalAlertsMatched` luôn = 2 (vô nghĩa), field `alerts` lộ nguyên tuple | Unpack đúng `rows, new_count` tại cả 2 caller; bổ sung `newAlerts` trong response |
| 2 | Thấp | `POST /api/asset-groups` **không validate rootDomain** → chấp nhận chuỗi rác ("khong hop le!!") | Thêm check `VALID_HOST_RE` → 400 |
| 3 | (phiên trước) Badge Inventory hardcode fallback 637 khi trống | Đã xoá mock |

## IV. Ghi chú

- Test dữ liệu dùng prefix `tc-` / `tc*.test.vn`, workspace riêng — xoá sạch sau khi chạy.
- Chạy lại suite: `backend/.venv/bin/python3 /tmp/test_suite.py`
- Live test đã phủ: subfinder thực (sohagame.com → 70 sub), telegram listener thực, AGI analyze thực (CVE-2024-9474), user session backfill (chờ đăng nhập OTP của user).
