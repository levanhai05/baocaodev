import crypto from "crypto";
import { service } from "./server";

const enc = (v: string | number) => encodeURIComponent(String(v)).replace(/%20/g, "+");
const query = (p: Record<string, string | number>) =>
  Object.keys(p).sort().map((k) => `${encodeURIComponent(k)}=${enc(p[k])}`).join("&");
const sign = (s: string) =>
  crypto.createHmac("sha512", process.env.VNP_HASH_SECRET!).update(Buffer.from(s, "utf-8")).digest("hex");
const vnTime = (d = new Date()) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().replace(/[-:T]/g, "").slice(0, 14);

export function buildPayUrl(o: { code: string; amount: number; ip: string }) {
  const p = {
    vnp_Version: "2.1.0", vnp_Command: "pay", vnp_TmnCode: process.env.VNP_TMN_CODE!,
    vnp_Amount: o.amount * 100, vnp_CreateDate: vnTime(), vnp_CurrCode: "VND", vnp_IpAddr: o.ip,
    vnp_Locale: "vn", vnp_OrderInfo: `Thanh toan don ${o.code}`, vnp_OrderType: "other",
    vnp_ReturnUrl: process.env.VNP_RETURN_URL!, vnp_TxnRef: o.code + String(Date.now()).slice(-6),
    vnp_ExpireDate: vnTime(new Date(Date.now() + 15 * 60 * 1000)),
  };
  const q = query(p);
  return `${process.env.VNP_URL}?${q}&vnp_SecureHash=${sign(q)}`;
}

export function verify(params: Record<string, string>) {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params;
  return !!vnp_SecureHash && sign(query(rest)).toLowerCase() === vnp_SecureHash.toLowerCase();
}

// Dùng chung cho Return URL và IPN. Idempotent.
export async function settle(params: Record<string, string>) {
  if (!verify(params)) return { rsp: "97", msg: "Invalid signature", ok: false, code: "" };
  const code = (params.vnp_TxnRef ?? "").slice(0, 6);
  const db = service();
  const { data: o } = await db.from("orders").select("id,total,payment_status").eq("code", code).maybeSingle();
  if (!o) return { rsp: "01", msg: "Order not found", ok: false, code };
  if (Number(params.vnp_Amount) !== o.total * 100) return { rsp: "04", msg: "Invalid amount", ok: false, code };
  if (o.payment_status === "paid") return { rsp: "02", msg: "Order already confirmed", ok: true, code };
  const ok = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
  await db.from("orders").update({ payment_status: ok ? "paid" : "failed" }).eq("id", o.id);
  return { rsp: "00", msg: "Confirm Success", ok, code };
}
