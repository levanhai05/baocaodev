import { NextResponse } from "next/server";
import { applyCoupon } from "@/lib/coupon";
import { service } from "@/lib/server";

export async function GET(req: Request) {
  const u = new URL(req.url);
  // Nếu khách đã đăng nhập thì kiểm tra luôn mã đã dùng chưa
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const userId = token ? (await service().auth.getUser(token)).data.user?.id ?? null : null;
  const r = await applyCoupon(u.searchParams.get("code") ?? "", Number(u.searchParams.get("subtotal")) || 0, userId);
  return NextResponse.json(r);
}