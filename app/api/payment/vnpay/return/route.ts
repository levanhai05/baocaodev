import { NextResponse } from "next/server";
import { settle } from "@/lib/vnpay";

// VNPay chuyển khách về đây sau khi thanh toán
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  const r = await settle(params);
  return NextResponse.redirect(new URL(`/track?code=${r.code}&paid=${r.ok ? 1 : 0}`, req.url));
}
