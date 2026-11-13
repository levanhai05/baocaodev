import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Khách hàng (trang chủ, giỏ hàng, tài khoản…): dùng khoá lưu phiên mặc định
export const supabase = createClient(url, key);

// Quản trị / nhân viên (/admin, /staff): khoá lưu phiên RIÊNG,
// nên đăng nhập/đăng xuất ở trang khách không ảnh hưởng admin và ngược lại.
export const supabaseAdmin = createClient(url, key, {
  auth: { storageKey: "burger-nha-admin-auth" },
});