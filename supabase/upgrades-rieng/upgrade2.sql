-- Mã giảm giá. Chạy trong SQL Editor (an toàn khi chạy lại)
create table if not exists coupons (
  code text primary key,
  description text,
  percent int check (percent between 1 and 100),
  amount int,
  min_order int default 0,
  max_discount int,
  active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table coupons enable row level security;
drop policy if exists "admin quản lý mã giảm giá" on coupons;
create policy "admin quản lý mã giảm giá" on coupons for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.coupons to authenticated, service_role;

alter table orders add column if not exists discount int default 0;
alter table orders add column if not exists coupon_code text;

insert into coupons (code, description, percent, min_order, max_discount)
values ('WELCOME10', 'Giảm 10% (tối đa 30.000đ) cho đơn từ 80.000đ', 10, 80000, 30000)
on conflict do nothing;
