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
