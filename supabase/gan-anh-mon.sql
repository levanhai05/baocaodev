-- Gắn ảnh cho món. Chạy SAU KHI đã upload file ảnh vào Storage > bucket "products".
-- Món nào chưa có file ảnh thì web tự hiện emoji, không bị lỗi.
update products p
set image_url = 'https://eistyhlkdddwfapkcycc.supabase.co/storage/v1/object/public/products/' || v.f
from (values
  ('Double Beef Burger',      'double-beef-burger.jpg'),
  ('Chicken Crunch Burger',   'chicken-crunch-burger.jpg'),
  ('Burger Bò Trứng',         'burger-bo-trung.jpg'),
  ('Gà rán 2 miếng',          'ga-ran-2-mieng.jpg'),
  ('Gà rán 6 miếng',          'ga-ran-6-mieng.jpg'),
  ('Gà viên popcorn',         'ga-vien-popcorn.jpg'),
  ('Khoai tây chiên',         'khoai-tay-chien.jpg'),
  ('Khoai phô mai',           'khoai-pho-mai.jpg'),
  ('Salad bắp cải',           'salad-bap-cai.jpg'),
  ('Coca-Cola',               'coca-cola.jpg'),
  ('Trà đào cam sả',          'tra-dao-cam-sa.jpg'),
  ('Kem sundae',              'kem-sundae.jpg'),
  ('Combo Burger Đôi',        'combo-burger-doi.jpg'),
  ('Combo Gà Rán Gia Đình',   'combo-ga-ran-gia-dinh.jpg'),
  ('Combo Tự Chọn',           'combo-tu-chon.jpg')
) as v(n, f)
where p.name = v.n;
