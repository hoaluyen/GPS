# Bản đồ GPS tổ trưởng - PGD Si Ma Cai

Leaflet + Cloudflare Workers + D1 (miễn phí, HTTPS, tên miền `*.workers.dev`).
Dữ liệu nguồn `Data/SIMACAI.xlsx` và `seed.sql` chứa thông tin cá nhân nên không đưa lên git.

## Chạy thử trên máy (Node + SQLite)
    npm i && node import.js && node server.js        # http://localhost:3000
(đặt biến `UPDATE_KEY` để yêu cầu mã truy cập)

## Triển khai lên Cloudflare (miễn phí)
1. Tạo tài khoản miễn phí tại https://dash.cloudflare.com/sign-up
2. `npm i` rồi `npx wrangler login`
3. `npx wrangler d1 create gps` -> chép `database_id` vào `wrangler.toml`
4. `node export-sql.js` (tạo `seed.sql`) rồi `npx wrangler d1 execute gps --remote --file=seed.sql`
5. `npx wrangler secret put ACCESS_KEY` -> nhập mã truy cập bí mật
6. `npx wrangler deploy` -> nhận địa chỉ `https://gps-simacai.<tài-khoản>.workers.dev`

Ai cũng xem được bản đồ (mã CIF bị ẩn). Cập nhật vị trí và xem mã CIF cần mã `ACCESS_KEY` (nút "Đăng nhập cập nhật" trên trang).

## Cập nhật theo đặc tả V2.1 (GIS Managed Integration)
- Bản đồ: cụm marker (bấm cụm để phóng to, điểm trùng tọa độ được tách ra), hủy request cũ khi đổi bộ lọc, hiện thời điểm cập nhật và nguồn dữ liệu, bộ lọc xã/thôn nằm trên URL (không chứa tên người/CIF).
- Khi hết nguồn bản đồ nền: hiện bảng tọa độ dạng số thay vì bản đồ trống.
- Ghim GPS (cần mã): máy chủ kiểm tra tọa độ và trả cảnh báo cần xác nhận (sai số > 50m, trùng tọa độ, lệch xã > 15km). Chọn vị trí thủ công gắn nguồn `MANUAL` và bắt buộc nhập lý do.
- Bảng `gps_log` (tự tạo khi dùng lần đầu) lưu bất biến mọi lần đổi tọa độ: tọa độ cũ/mới, sai số, nguồn, lý do, cảnh báo, IP, thời gian. Xem trong popup ("Lịch sử tọa độ"), `GET /api/to-truong/:id/lich-su`.
- Lỗi API theo mẫu `{code, message, request_id, details?}`; `GET /api/health` (cần mã).
- Báo cáo: thêm KPI "Ghim 30 ngày qua", sắp xếp "địa bàn ưu tiên", thời điểm chốt số liệu.
- Chưa làm (cần backend/phân quyền riêng, xem đặc tả): đăng nhập theo vai trò, duyệt GPS, phân công, import, offline PWA. `server.js` (chạy local) chưa đồng bộ các thay đổi này.
