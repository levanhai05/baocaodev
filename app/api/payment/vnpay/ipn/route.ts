import { NextResponse } from "next/server";
import { settle } from "@/lib/vnpay";

// Khai báo URL này (https://tên-miền/api/payment/vnpay/ipn) trong trang cấu hình IPN của VNPay
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  const r = await settle(params);
  return NextResponse.json({ RspCode: r.rsp, Message: r.msg });
}
