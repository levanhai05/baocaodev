-- BAN CAI MOI HOAN CHINH: chay 1 lan trong SQL Editor cua project Supabase MOI.
-- CANH BAO: file nay XOA va tao lai cac bang (mat du lieu). Khong chay tren database dang co du lieu that.
-- Sau do chay them dong 'insert into admins' o cuoi file de cap quyen admin.

-- ===== 1. schema =====
-- Chạy toàn bộ file này trong Supabase → SQL Editor (xóa và tạo lại các bảng bên dưới)
drop table if exists order_items, orders, products, categories, admins cascade;

create table admins (user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function is_admin() returns boolean
  language sql security definer stable as $$ select exists(select 1 from admins where user_id = auth.uid()) $$;

create table categories (id serial primary key, name text not null, sort int default 0);
create table products (
  id serial primary key,
  category_id int references categories(id) on delete set null,
  name text not null, description text, price int not null,
  emoji text default '🍔', image_url text,
  is_hot boolean default false, is_available boolean default true,
  created_at timestamptz default now()
);
create table orders (
  id uuid primary key,
  code text unique not null,
  customer_name text not null, phone text not null, address text not null, note text,
  payment_method text default 'cod',
  shipping_fee int default 0, total int not null,
  status text default 'new' check (status in ('new','preparing','delivering','done','cancelled')),
  created_at timestamptz default now()
);
create table order_items (
  id serial primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id int references products(id) on delete set null,
  name text not null, price int not null, qty int not null check (qty > 0)
);

alter table admins enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "admin tự đọc" on admins for select using (user_id = auth.uid());
create policy "xem danh mục" on categories for select using (true);
create policy "xem món" on products for select using (true);
create policy "admin sửa danh mục" on categories for all using (is_admin()) with check (is_admin());
create policy "admin sửa món" on products for all using (is_admin()) with check (is_admin());
-- Đơn hàng: khách KHÔNG ghi/đọc trực tiếp. Tạo đơn và tra cứu đi qua API server (service role).
create policy "admin quản lý đơn" on orders for all using (is_admin()) with check (is_admin());
create policy "admin quản lý món trong đơn" on order_items for all using (is_admin()) with check (is_admin());

-- Kho ảnh món ăn
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict do nothing;
create policy "xem ảnh" on storage.objects for select using (bucket_id = 'products');
create policy "admin upload ảnh" on storage.objects for all
  using (bucket_id = 'products' and is_admin()) with check (bucket_id = 'products' and is_admin());

insert into categories (name, sort) values ('Burger',1),('Gà rán',2),('Khoai & ăn kèm',3),('Đồ uống',4);
insert into products (category_id, name, description, price, emoji, is_hot) values
(1,'Double Beef Burger','2 lớp bò nướng, phô mai cheddar, dưa chua, sốt đặc biệt',69000,'🍔',true),
(1,'Chicken Crunch Burger','Gà giòn cay, xà lách, sốt mayo',55000,'🍔',false),
(1,'Burger Bò Trứng','Bò nướng, trứng ốp la, hành caramen',59000,'🍔',false),
(2,'Gà rán 2 miếng','Giòn rụm, tẩm ướp 11 loại gia vị',65000,'🍗',true),
(2,'Gà rán 6 miếng','Phần chia sẻ cho cả nhóm',179000,'🍗',false),
(2,'Gà viên popcorn','Phần vừa, kèm sốt chấm',45000,'🍗',false),
(3,'Khoai tây chiên','Phần vừa, rắc muối',29000,'🍟',false),
(3,'Khoai phô mai','Khoai chiên phủ sốt phô mai nóng',39000,'🍟',true),
(3,'Salad bắp cải','Mát, ít béo',22000,'🥗',false),
(4,'Coca-Cola','Ly lớn, nhiều đá',19000,'🥤',false),
(4,'Trà đào cam sả','Pha mới mỗi ngày',32000,'🍑',true),
(4,'Kem sundae','Sốt chocolate hoặc dâu',25000,'🍦',false);

-- SAU KHI tạo user admin ở Authentication → Users, chạy (đổi email):
-- insert into admins (user_id) select id from auth.users where email = 'admin@example.com';

-- ===== 2. thanh toan, tai khoan khach =====
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

-- ===== 3. cap quyen cho anon / authenticated / service_role =====
grant usage on schema public to anon, authenticated, service_role;
grant select on public.categories, public.products to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- ===== upgrade2 =====
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

-- ===== upgrade3 =====
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

-- ===== upgrade4 =====
-- Đợt 2 + 3. Chạy trong SQL Editor (an toàn khi chạy lại)

-- Cài đặt cửa hàng (1 dòng duy nhất)
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  shop_name text default 'Burger Nhà', hotline text default '0900 000 000',
  address text default 'Số 1, Đường ABC, Quận X',
  ship_fee int default 15000, free_ship_from int default 150000,
  is_open boolean default true, banner_text text default 'Miễn phí giao hàng cho đơn từ 150.000đ'
);
insert into settings (id) values (1) on conflict do nothing;
alter table settings enable row level security;
drop policy if exists "xem cài đặt" on settings; create policy "xem cài đặt" on settings for select using (true);
drop policy if exists "admin sửa cài đặt" on settings; create policy "admin sửa cài đặt" on settings for all using (is_admin()) with check (is_admin());
grant select on public.settings to anon;
grant select, insert, update on public.settings to authenticated, service_role;

-- Món: tuỳ chọn (size/topping...), giá khuyến mãi theo thời gian
alter table products add column if not exists options jsonb;
alter table products add column if not exists sale_price int;
alter table products add column if not exists sale_until timestamptz;
alter table order_items add column if not exists options text;
alter table order_items add column if not exists note text;

-- Đơn: giao/tự lấy, hẹn giờ, điểm thưởng
alter table orders add column if not exists fulfillment text default 'delivery';
alter table orders add column if not exists scheduled_for text;
alter table orders add column if not exists points_used int default 0;
alter table orders add column if not exists points_awarded boolean default false;
alter table profiles add column if not exists points int default 0;
-- Khách chỉ được sửa họ tên/SĐT/địa chỉ, KHÔNG sửa được điểm
revoke insert, update on public.profiles from authenticated;
grant insert (id, full_name, phone, address), update (full_name, phone, address) on public.profiles to authenticated;

create or replace function award_points() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.user_id is not null and not coalesce(new.points_awarded, false) then
    insert into profiles (id, points) values (new.user_id, floor(new.total / 10000))
    on conflict (id) do update set points = coalesce(profiles.points, 0) + floor(new.total / 10000);
    new.points_awarded := true;
  end if;
  return new;
end $$;
drop trigger if exists trg_award_points on orders;
create trigger trg_award_points before update on orders for each row execute function award_points();

-- Đánh giá món
create table if not exists reviews (
  id serial primary key,
  product_id int references products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  author text, rating int not null check (rating between 1 and 5), comment text,
  created_at timestamptz default now(), unique (product_id, user_id)
);
alter table reviews enable row level security;
drop policy if exists "xem đánh giá" on reviews; create policy "xem đánh giá" on reviews for select using (true);
drop policy if exists "khách gửi đánh giá" on reviews; create policy "khách gửi đánh giá" on reviews for insert with check (user_id = auth.uid());
drop policy if exists "khách sửa đánh giá" on reviews; create policy "khách sửa đánh giá" on reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin xoá đánh giá" on reviews; create policy "admin xoá đánh giá" on reviews for delete using (is_admin());
grant select on public.reviews to anon;
grant select, delete on public.reviews to authenticated, service_role;
grant insert (product_id, user_id, author, rating, comment), update (rating, comment) on public.reviews to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Món yêu thích
create table if not exists favorites (
  user_id uuid references auth.users(id) on delete cascade,
  product_id int references products(id) on delete cascade,
  primary key (user_id, product_id)
);
alter table favorites enable row level security;
drop policy if exists "yêu thích của tôi" on favorites;
create policy "yêu thích của tôi" on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.favorites to authenticated, service_role;

-- Dữ liệu mẫu: combo + tuỳ chọn cho burger và khoai
insert into categories (name, sort) select 'Combo', 0 where not exists (select 1 from categories where name = 'Combo');
insert into products (category_id, name, description, price, emoji, is_hot)
select c.id, v.n, v.d, v.p, '🍱', true from categories c,
 (values ('Combo Burger Đôi','2 Double Beef Burger + 2 khoai chiên + 2 nước ngọt',169000),
         ('Combo Gà Rán Gia Đình','6 miếng gà rán + 2 khoai chiên + 3 nước ngọt',239000)) as v(n,d,p)
where c.name = 'Combo' and not exists (select 1 from products where name = v.n);
update products set options = '[{"name":"Size","required":true,"multi":false,"choices":[{"name":"Vừa","price":0},{"name":"Lớn","price":10000}]},{"name":"Thêm","required":false,"multi":true,"choices":[{"name":"Phô mai","price":8000},{"name":"Bacon","price":15000},{"name":"Trứng ốp la","price":7000}]}]'::jsonb
where options is null and category_id in (select id from categories where name = 'Burger');
update products set options = '[{"name":"Size","required":true,"multi":false,"choices":[{"name":"Vừa","price":0},{"name":"Lớn","price":10000}]},{"name":"Sốt chấm","required":false,"multi":true,"choices":[{"name":"Sốt phô mai","price":5000},{"name":"Sốt cay","price":3000}]}]'::jsonb
where options is null and name in ('Khoai tây chiên','Khoai phô mai');

-- ===== upgrade5 =====
-- Sổ địa chỉ giao hàng. Chạy trong SQL Editor (an toàn khi chạy lại)
create table if not exists addresses (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Địa chỉ',
  address text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);
alter table addresses enable row level security;
drop policy if exists "địa chỉ của tôi" on addresses;
create policy "địa chỉ của tôi" on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.addresses to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated;

-- ===== upgrade6 =====
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
