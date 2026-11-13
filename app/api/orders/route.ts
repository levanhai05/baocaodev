import { NextResponse } from "next/server";
import { clientIp, genCode, service } from "@/lib/server";
import { effectivePrice, vnd, type OptionGroup } from "@/lib/types";
import { applyCoupon } from "@/lib/coupon";
import { sendMail } from "@/lib/mail";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (b?.website) return NextResponse.json({ code: "XXXXXX", total: 0 }); // honeypot

  const items: { id: number; qty: number; picks?: [number, number][]; note?: string }[] = Array.isArray(b?.items) ? b.items : [];
  const pickup = b?.fulfillment === "pickup";
  if (!b?.name?.trim() || !/^[0-9+ ]{9,13}$/.test(b?.phone ?? "") || (!pickup && !b?.address?.trim()) || !items.length || items.length > 30)
    return bad("Thiếu hoặc sai thông tin đơn hàng.");

  const db = service();
  const { data: st } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (st && st.is_open === false) return bad("Cửa hàng đang tạm đóng cửa, vui lòng quay lại sau.");

  const token0 = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token0 || !(await db.auth.getUser(token0)).data.user) return bad("Vui lòng đăng nhập để đặt hàng.", 401);

  const ip = clientIp(req);
  const { count } = await db.from("orders").select("id", { count: "exact", head: true })
    .eq("ip", ip).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 5) return bad("Bạn đặt quá nhiều đơn trong thời gian ngắn. Vui lòng thử lại sau ít phút.", 429);

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  let userId: string | null = null, userEmail: string | undefined;
  if (token) { const u = (await db.auth.getUser(token)).data.user; userId = u?.id ?? null; userEmail = u?.email ?? undefined; }

  const { data: products } = await db.from("products").select("id,name,price,cost,sale_price,sale_until,options,is_available").in("id", items.map((i) => i.id));
  const map = new Map((products ?? []).map((p) => [p.id, p]));

  const orderId = crypto.randomUUID();
  const rows = [];
  let subtotal = 0;
  for (const i of items) {
    const p = map.get(i.id);
    const qty = Math.floor(Number(i.qty));
    if (!p || !p.is_available || !(qty >= 1 && qty <= 50)) return bad("Có món không còn bán, vui lòng tải lại trang.");
    const groups = (p.options ?? []) as OptionGroup[];
    const cnt = new Map<number, number>();
    let extra = 0;
    const labels: string[] = [];
    for (const pk of Array.isArray(i.picks) ? i.picks : []) {
      const ch = groups[pk?.[0]]?.choices?.[pk?.[1]];
      if (!ch) return bad("Tuỳ chọn món không hợp lệ.");
      cnt.set(pk[0], (cnt.get(pk[0]) ?? 0) + 1);
      extra += ch.price; labels.push(ch.name);
    }
    for (let g = 0; g < groups.length; g++) {
      const n = cnt.get(g) ?? 0;
      if ((groups[g].required && n === 0) || (!groups[g].multi && n > 1)) return bad(`Vui lòng chọn "${groups[g].name}" cho món ${p.name}.`);
    }
    const unit = effectivePrice(p) + extra;
    subtotal += unit * qty;
    rows.push({ order_id: orderId, product_id: p.id, name: p.name, price: unit, cost: p.cost ?? 0, qty, options: labels.join(", ") || null, note: String(i.note ?? "").slice(0, 120) || null });
  }

  let discount = 0, couponCode: string | null = null;
  if (b.coupon) {
    const r = await applyCoupon(b.coupon, subtotal, userId);
    if (!r.ok) return bad(r.error);
    discount = r.discount; couponCode = r.code;
  }

  // Voucher đổi từ điểm thưởng: phải của chính khách, chưa dùng, chưa hết hạn, đủ đơn tối thiểu
  let voucherDiscount = 0, voucherId: string | null = null;
  if (b.voucher) {
    if (!userId) return bad("Vui lòng đăng nhập để dùng voucher.", 401);
    const { data: v } = await db.from("vouchers").select("*").eq("id", String(b.voucher)).eq("user_id", userId).maybeSingle();
    if (!v || v.used_at || new Date(v.expires_at) < new Date()) return bad("Voucher không hợp lệ, đã dùng hoặc đã hết hạn.");
    if (subtotal - discount < v.min_order) return bad(`Voucher này áp dụng cho đơn từ ${vnd(v.min_order)}.`);
    voucherDiscount = Math.min(v.amount, subtotal - discount);
    voucherId = v.id;
  }

  const shipping = pickup || subtotal >= (st?.free_ship_from ?? 150000) ? 0 : st?.ship_fee ?? 15000;
  const total = subtotal - discount - voucherDiscount + shipping;
  const code = genCode();
  const payment = b.payment === "bank" ? "bank" : "cod";

  const releaseVoucher = () => voucherId ? db.from("vouchers").update({ used_at: null, order_id: null }).eq("id", voucherId) : Promise.resolve();
  const releaseCoupon = () => couponCode && userId
    ? db.from("coupon_uses").delete().eq("code", couponCode).eq("user_id", userId).eq("order_id", orderId) : Promise.resolve();
  const release = () => Promise.all([releaseVoucher(), releaseCoupon()]);

  // Chiếm mã giảm giá trước: khoá chính (code, user_id) nên mỗi khách chỉ dùng 1 lần, 2 đơn cùng lúc cũng không dùng trùng được
  if (couponCode && userId) {
    const { error: ce } = await db.from("coupon_uses").insert({ code: couponCode, user_id: userId, order_id: orderId });
    if (ce) return ce.code === "23505" ? bad("Bạn đã dùng mã này rồi.") : bad("Không áp dụng được mã giảm giá.", 500);
  }
  // Chiếm voucher (cập nhật có điều kiện used_at is null nên 2 đơn cùng lúc không dùng trùng được)
  if (voucherId) {
    const { data: claimed } = await db.from("vouchers").update({ used_at: new Date().toISOString(), order_id: orderId })
      .eq("id", voucherId).is("used_at", null).select("id");
    if (!claimed?.length) { await releaseCoupon(); return bad("Voucher này vừa được dùng cho đơn khác."); }
  }

  const o = await db.from("orders").insert({
    id: orderId, code, customer_name: b.name.trim(), phone: b.phone.trim(),
    address: pickup ? "Tự đến lấy tại cửa hàng" : b.address.trim(), note: b.note?.trim() || null,
    payment_method: payment, shipping_fee: shipping, total, discount, coupon_code: couponCode,
    fulfillment: pickup ? "pickup" : "delivery", scheduled_for: b.scheduled_for ? String(b.scheduled_for).slice(0, 10) : null,
    voucher_id: voucherId, voucher_discount: voucherDiscount, user_id: userId, ip,
  });
  if (o.error) { await release(); return bad("Không tạo được đơn hàng.", 500); }
  const oi = await db.from("order_items").insert(rows);
  if (oi.error) { await db.from("orders").delete().eq("id", orderId); await release(); return bad("Không lưu được món trong đơn.", 500); }

  // Email thông báo (cần RESEND_API_KEY; bỏ qua nếu chưa cấu hình)
  const list = rows.map((r) => `<li>${r.name} × ${r.qty}${r.options ? ` (${r.options})` : ""}</li>`).join("");
  const html = `<h3>Đơn #${code}</h3><p>${b.name} · ${b.phone}</p><p>${pickup ? "Tự đến lấy" : b.address}</p><ul>${list}</ul><p><b>Tổng: ${vnd(total)}</b></p>`;
  await Promise.all([
    sendMail(process.env.NOTIFY_EMAIL, `Đơn mới #${code} - ${vnd(total)}`, html),
    sendMail(userEmail, `Phố Burger đã nhận đơn #${code}`, html + "<p>Cảm ơn bạn đã đặt hàng!</p>"),
  ]);

  return NextResponse.json({ code, total });
}