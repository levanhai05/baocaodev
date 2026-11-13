import { NextResponse } from "next/server";
import { clientIp, service } from "@/lib/server";
import { buildPayUrl } from "@/lib/vnpay";

// Tạo link thanh toán VNPay cho 1 đơn (dùng cả khi "thanh toán lại")
export async function POST(req: Request) {
  const { code, phone } = await req.json().catch(() => ({}));
  const { data: o } = await service().from("orders")
    .select("code,total,payment_method,payment_status,status")
    .eq("code", String(code ?? "").toUpperCase()).eq("phone", String(phone ?? "")).maybeSingle();
  if (!o || o.payment_method !== "vnpay") return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });
  if (o.payment_status === "paid") return NextResponse.json({ error: "Đơn đã được thanh toán." }, { status: 400 });
  if (o.status === "cancelled") return NextResponse.json({ error: "Đơn đã bị huỷ." }, { status: 400 });
  return NextResponse.json({ url: buildPayUrl({ code: o.code, amount: o.total, ip: clientIp(req) }) });
}
