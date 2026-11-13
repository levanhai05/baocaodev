import { NextResponse } from "next/server";
import { service } from "@/lib/server";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") ?? "").trim().toUpperCase();
  const phone = (u.searchParams.get("phone") ?? "").trim();
  if (!code || !phone) return NextResponse.json({ error: "Nhập mã đơn và số điện thoại." }, { status: 400 });

  const { data } = await service().from("orders")
    .select("code,status,total,shipping_fee,discount,voucher_discount,coupon_code,payment_method,payment_status,address,created_at,order_items(name,price,qty,options,note)")
    .eq("code", code).eq("phone", phone).maybeSingle();
  if (!data) return NextResponse.json({ error: "Không tìm thấy đơn. Kiểm tra lại mã đơn và số điện thoại." }, { status: 404 });
  return NextResponse.json(data);
}