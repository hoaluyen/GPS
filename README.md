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

Mọi API đều yêu cầu mã `ACCESS_KEY` (trang sẽ hỏi khi mở). Không chạy lại bước 4 sau khi đã có cập nhật GPS vì nó xóa dữ liệu cũ.
