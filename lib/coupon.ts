import { service } from "./server";
import { vnd } from "./types";

export async function applyCoupon(code: string, subtotal: number, userId?: string | null) {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) return { ok: false as const, error: "Nhập mã giảm giá." };
  const { data } = await service().from("coupons").select("*").eq("code", c).maybeSingle();
  if (!data || !data.active || (data.expires_at && new Date(data.expires_at) < new Date()))
    return { ok: false as const, error: "Mã giảm giá không hợp lệ hoặc đã hết hạn." };
  // Mỗi khách chỉ dùng 1 lần (bảng coupon_uses, khoá chính code + user_id)
  if (userId) {
    const { data: used } = await service().from("coupon_uses").select("code").eq("code", c).eq("user_id", userId).maybeSingle();
    if (used) return { ok: false as const, error: "Bạn đã dùng mã này rồi." };
  }
  if (subtotal < (data.min_order ?? 0))
    return { ok: false as const, error: `Đơn tối thiểu ${Number(data.min_order).toLocaleString("vi-VN")}đ để dùng mã này.` };
  let d = data.percent ? Math.floor((subtotal * data.percent) / 100) : data.amount ?? 0;
  if (data.max_discount) d = Math.min(d, data.max_discount);
  d = Math.min(d, subtotal);
  return { ok: true as const, code: c, discount: d, description: (data.description ?? null) as string | null };
}

// Chữ hiển thị mã trên trang chủ: { code: "WELCOME10", rest: "giảm 10% (tối đa 30.000đ) · đơn từ 80.000đ" }
export type CouponRow = { code: string; percent: number | null; amount: number | null; min_order: number | null; max_discount: number | null; expires_at: string | null };
export function couponParts(c: CouponRow) {
  const off = c.percent ? `${c.percent}%${c.max_discount ? ` (tối đa ${vnd(c.max_discount)})` : ""}` : vnd(c.amount ?? 0);
  return { code: c.code, rest: `giảm ${off}${c.min_order ? ` · đơn từ ${vnd(c.min_order)}` : ""}` };
}