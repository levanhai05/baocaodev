
-- Phố Burger: khóa quyền truy cập đơn hàng trực tiếp của nhân viên.
-- Các thao tác của Bếp và Shipper sẽ đi qua API server dùng service_role.

BEGIN;

-- Xóa các policy cũ cho phép mọi nhân viên xem tất cả đơn.
DROP POLICY IF EXISTS "staff xem đơn" ON public.orders;
DROP POLICY IF EXISTS "staff cập nhật đơn" ON public.orders;
DROP POLICY IF EXISTS "staff xem món trong đơn" ON public.order_items;

-- Thu hồi quyền UPDATE trực tiếp của nhân viên.
REVOKE UPDATE ON public.orders FROM authenticated;

-- Thu hồi cả quyền UPDATE cấp cột đã cấp trước đó.
REVOKE UPDATE (status, payment_status)
ON public.orders FROM authenticated;

COMMIT;
