-- Đợt 3 (phần còn lại). Chạy trong SQL Editor (an toàn khi chạy lại). Cần đã chạy upgrade4.sql.
create table if not exists stores (
  id serial primary key,
  name text not null, address text not null, phone text, hours text,
  lat double precision, lng double precision,
  active boolean default true, created_at timestamptz default now()
);
alter table stores enable row level security;
drop policy if exists "xem cửa hàng" on stores; create policy "xem cửa hàng" on stores for select using (active or is_admin());
drop policy if exists "admin quản lý cửa hàng" on stores; create policy "admin quản lý cửa hàng" on stores for all using (is_admin()) with check (is_admin());
grant select on public.stores to anon;
grant select, insert, update, delete on public.stores to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated;
insert into stores (name, address, phone, hours, lat, lng)
select 'Burger Nhà - Chi nhánh 1', 'Số 1, Đường ABC, Quận X', '0900 000 000', '9:00 - 22:00', null, null
where not exists (select 1 from stores);

-- Giá vốn để tính lợi nhuận
alter table products add column if not exists cost int;
alter table order_items add column if not exists cost int default 0;

-- Combo tự chọn: dùng hệ thống tuỳ chọn (mỗi nhóm bắt buộc chọn 1)
insert into products (category_id, name, description, price, emoji, is_hot, options)
select c.id, 'Combo Tự Chọn', 'Tự chọn burger, món ăn kèm và đồ uống theo ý bạn', 89000, '🍱', true,
 '[{"name":"Burger","required":true,"multi":false,"choices":[{"name":"Chicken Crunch","price":0},{"name":"Burger Bò Trứng","price":4000},{"name":"Double Beef","price":14000}]},{"name":"Món ăn kèm","required":true,"multi":false,"choices":[{"name":"Khoai tây chiên","price":0},{"name":"Gà viên popcorn","price":10000},{"name":"Salad bắp cải","price":0}]},{"name":"Đồ uống","required":true,"multi":false,"choices":[{"name":"Coca-Cola","price":0},{"name":"Trà đào cam sả","price":10000}]}]'::jsonb
from categories c where c.name = 'Combo' and not exists (select 1 from products where name = 'Combo Tự Chọn');
