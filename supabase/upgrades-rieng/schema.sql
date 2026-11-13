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
