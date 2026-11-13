-- Đợt 1: nhân viên + trạng thái đơn đầy đủ + realtime. Chạy trong SQL Editor (an toàn khi chạy lại)
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('new','confirmed','preparing','delivering','done','cancelled'));

create table if not exists staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);
alter table staff enable row level security;
create or replace function is_staff() returns boolean
  language sql security definer stable as $$ select exists(select 1 from staff where user_id = auth.uid()) $$;

drop policy if exists "staff tự đọc" on staff;
create policy "staff tự đọc" on staff for select using (user_id = auth.uid());
drop policy if exists "admin quản lý staff" on staff;
create policy "admin quản lý staff" on staff for all using (is_admin()) with check (is_admin());

-- Nhân viên: xem và cập nhật đơn, không xoá, không sửa món
drop policy if exists "staff xem đơn" on orders;
create policy "staff xem đơn" on orders for select using (is_staff());
drop policy if exists "staff cập nhật đơn" on orders;
create policy "staff cập nhật đơn" on orders for update using (is_staff()) with check (is_staff());
drop policy if exists "staff xem món trong đơn" on order_items;
create policy "staff xem món trong đơn" on order_items for select using (is_staff());
grant select, insert, update, delete on public.staff to authenticated, service_role;

-- Chỉ cho sửa cột trạng thái (không ai sửa được tổng tiền, địa chỉ... từ trình duyệt)
revoke update on public.orders from authenticated;
grant update (status, payment_status) on public.orders to authenticated;

-- Bật realtime cho bảng orders
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
