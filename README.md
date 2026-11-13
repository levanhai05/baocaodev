# Burger Nhà — Next.js + Supabase

## Cài mới
1. `npm install`
2. Supabase → SQL Editor: dán toàn bộ `supabase/00-CAI-MOI-DAY-DU.sql` rồi Run (chỉ dùng cho project MỚI, file xoá và tạo lại bảng).
3. Authentication → Users → Add user (tick Auto Confirm User), rồi chạy trong SQL Editor:
   `insert into admins (user_id) select id from auth.users where email = 'email-admin';`
4. Copy `.env.local.example` → `.env.local`, điền URL + publishable key (vào biến ANON_KEY) + secret key (vào SERVICE_ROLE_KEY).
5. `npm run dev` → khách: http://localhost:3000 · quản trị/nhân viên: http://localhost:3000/admin/login

## Đã có database từ các bản cũ
Chạy các file còn thiếu trong `supabase/upgrades-rieng/` theo thứ tự: upgrade2 → upgrade3 → upgrade4 → upgrade5 → upgrade6.

## Tuỳ chọn
- VNPay: điền `VNP_*` trong `.env.local` (sandbox: https://sandbox.vnpayment.vn/devreg). Khi deploy: đổi `VNP_RETURN_URL`, khai báo IPN `https://tên-miền/api/payment/vnpay/ipn`.
- QR chuyển khoản: điền `NEXT_PUBLIC_BANK_*`.
- Email đơn mới: `RESEND_API_KEY`, `NOTIFY_EMAIL`. Live chat: `NEXT_PUBLIC_TAWK_SRC`.
- Deploy: Vercel, thêm các biến trong `.env.local` vào Environment Variables.
