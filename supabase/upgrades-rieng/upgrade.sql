-- Chạy SAU schema.sql (hoặc chạy riêng nếu đã có dữ liệu). An toàn khi chạy lại.
alter table orders add column if not exists payment_status text default 'unpaid'
  check (payment_status in ('unpaid','paid','failed'));
alter table orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table orders add column if not exists ip text;
alter table orders drop constraint if exists orders_payment_method_check;
create index if not exists orders_ip_time on orders (ip, created_at);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, phone text, address text
);
alter table profiles enable row level security;
drop policy if exists "profile của tôi" on profiles;
create policy "profile của tôi" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "khách xem đơn của mình" on orders;
create policy "khách xem đơn của mình" on orders for select using (user_id = auth.uid());
drop policy if exists "khách xem món trong đơn của mình" on order_items;
create policy "khách xem món trong đơn của mình" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
