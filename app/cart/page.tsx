"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { LogoMark } from "@/components/Logo";
import { unitOf, useCart, type Line } from "@/components/CartProvider";
import ProductModal from "@/components/ProductModal";
import { supabase } from "@/lib/supabase";
import BankTransfer from "@/components/BankTransfer";
import { vnd, type Voucher } from "@/lib/types";
import "./cart.css";

// Gửi kèm token đăng nhập để server biết khách này đã dùng mã chưa
async function authFetch(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, session ? { headers: { Authorization: `Bearer ${session.access_token}` } } : undefined);
}

export default function CartPage() {
  const { lines, count, total, settings, change, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ code: string; total: number; payment: string } | null>(null);
  const [prof, setProf] = useState<{ id?: string; full_name?: string; phone?: string; address?: string; points?: number }>({});
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [pickup, setPickup] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherId, setVoucherId] = useState("");
  const [addrs, setAddrs] = useState<{ id: number; label: string; address: string; is_default: boolean }[]>([]);
  const [addr, setAddr] = useState("");
  const [editing, setEditing] = useState<Line | null>(null);

  const discount = applied?.discount ?? 0;
  const ship = pickup || total >= settings.free_ship_from ? 0 : settings.ship_fee;
  const voucher = vouchers.find((v) => v.id === voucherId);
  const voucherOk = !!voucher && total - discount >= voucher.min_order;
  const voucherDiscount = voucher && voucherOk ? Math.min(voucher.amount, total - discount) : 0;
  const grand = total - discount - voucherDiscount + ship;
  const shipLeft = Math.max(0, settings.free_ship_from - total);
  const shipPct = settings.free_ship_from > 0 ? Math.min(100, Math.round((total / settings.free_ship_from) * 100)) : 100;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from("profiles").select("*").maybeSingle().then(({ data }) => {
        if (data) { setProf(data); setAddr((a) => a || data.address || ""); }
      });
      supabase.from("vouchers").select("*").is("used_at", null).gt("expires_at", new Date().toISOString()).order("expires_at").then(({ data }) => setVouchers((data ?? []) as Voucher[]));
      supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("id").then(({ data }) => {
        const l = (data ?? []) as { id: number; label: string; address: string; is_default: boolean }[];
        setAddrs(l);
        if (l[0]) setAddr(l[0].address);
      });
    });
  }, []);

  useEffect(() => {
    if (!applied) return;
    authFetch(`/api/coupon?code=${encodeURIComponent(applied.code)}&subtotal=${total}`).then((r) => r.json()).then((d) => {
      if (d.ok) setApplied({ code: d.code, discount: d.discount });
      else { setApplied(null); setCouponMsg(d.error); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  async function applyCoupon() {
    setCouponMsg("");
    const d = await (await authFetch(`/api/coupon?code=${encodeURIComponent(couponInput)}&subtotal=${total}`)).json();
    if (d.ok) { setApplied({ code: d.code, discount: d.discount }); setCouponMsg(d.description ?? "Đã áp dụng mã."); }
    else { setApplied(null); setCouponMsg(d.error); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payment = String(f.get("payment"));
    const phone = String(f.get("phone"));
    setBusy(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({
        name: f.get("name"), phone, address: f.get("address"), note: f.get("note"), payment, website: f.get("website"),
        coupon: applied?.code ?? null, fulfillment: pickup ? "pickup" : "delivery",
        scheduled_for: scheduled ? f.get("time") : null, voucher: voucherDiscount > 0 ? voucherId : null,
        items: lines.map((l) => ({ id: l.product.id, qty: l.qty, picks: l.picks, note: l.note })),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setBusy(false); setError(data.error ?? "Đặt hàng thất bại. Vui lòng thử lại."); return; }
    clear(); setApplied(null); setCouponInput(""); setCouponMsg("");
    if (voucherId) { setVouchers((vs) => vs.filter((v) => v.id !== voucherId)); setVoucherId(""); }

    setBusy(false);
    setDone({ code: data.code, total: data.total, payment });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <Header />
      <main className="cart-page">
        <div className="cart-head">
          <Link href="/#menu" className="back">← Tiếp tục chọn món</Link>
          <h1>{done ? "Đặt hàng thành công" : "Giỏ hàng"}</h1>
          {count > 0 && !done && <span className="dr-count">{count} món</span>}
        </div>

        {done ? (
          <div className="done-card">
            <span className="empty-ic"><LogoMark size={46} /></span>
            <p>Đã nhận đơn! Mã đơn của bạn:</p>
            <p className="code">{done.code}</p>
            {done.payment === "bank" && <BankTransfer code={done.code} total={done.total} />}
            <p>Dùng mã này và số điện thoại để theo dõi đơn hàng.</p>
            <div className="done-actions">
              <Link href={`/track?code=${done.code}`} className="btn">Theo dõi đơn ↗</Link>
              <Link href="/#menu" className="btn ghost">Đặt thêm món</Link>
            </div>
          </div>
        ) : lines.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><LogoMark size={46} /></span>
            <h3>Giỏ hàng đang trống</h3>
            <p>Chọn vài món ngon từ thực đơn để bắt đầu nhé.</p>
            <Link href="/#menu" className="btn">Xem thực đơn ↗</Link>
          </div>
        ) : (
          <div className="cart-grid">
            <section className="cart-main">
              {!settings.is_open && <p className="notice error">Cửa hàng đang tạm đóng cửa, hiện chưa nhận đơn.</p>}

              {!pickup && settings.free_ship_from > 0 && (
                <div className="shipbar">
                  <p>{shipLeft > 0 ? <>Mua thêm <b>{vnd(shipLeft)}</b> để được <b>miễn phí giao hàng</b></> : <>✓ Đơn của bạn được <b>miễn phí giao hàng</b></>}</p>
                  <div className="shipbar-track"><i style={{ width: `${shipPct}%` }} /></div>
                </div>
              )}

              <ul className="lines">
                {lines.map((l) => (
                  <li key={l.key}>
                    {l.product.image_url ? <img src={l.product.image_url} alt="" className="cart-thumb" /> : <span className="cart-thumb emoji">{l.product.emoji}</span>}
                    <div className="ln-info">
                      <strong>{l.product.name}</strong>
                      {l.label && <small className="sub">{l.label}</small>}
                      {l.note && <small className="sub"><i>“{l.note}”</i></small>}
                      <small className="sub">{vnd(unitOf(l))} / phần</small>
                      {(l.product.options?.length ?? 0) > 0 && <button type="button" className="link edit-opt" onClick={() => setEditing(l)}>Đổi tùy chọn</button>}
                    </div>
                    <div className="ln-right">
                      <b>{vnd(l.qty * unitOf(l))}</b>
                      <span className="qty">
                        <button onClick={() => change(l.key, -1)} aria-label="Giảm">−</button>
                        {l.qty}
                        <button onClick={() => change(l.key, 1)} aria-label="Tăng">+</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <form id="checkout" className="checkout" onSubmit={submit} key={prof.id ?? "guest"}>
                <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden />
                <div className="cap">Thông tin đặt hàng</div>
                <div className="cf-row">
                  <label>Họ tên<input name="name" required defaultValue={prof.full_name ?? ""} /></label>
                  <label>Số điện thoại<input name="phone" required inputMode="tel" pattern="[0-9+ ]{9,13}" defaultValue={prof.phone ?? ""} /></label>
                </div>
                {pickup
                  ? <p className="notice">Nhận tại: {settings.address}</p>
                  : <>
                    {addrs.length > 0 && (
                      <label>Địa chỉ đã lưu
                        <select value="" onChange={(e) => e.target.value && setAddr(e.target.value)}>
                          <option value="">— Chọn địa chỉ đã lưu —</option>
                          {addrs.map((a) => <option key={a.id} value={a.address}>{a.label}: {a.address}</option>)}
                        </select>
                      </label>
                    )}
                    <label>Địa chỉ giao hàng<input name="address" required value={addr} onChange={(e) => setAddr(e.target.value)} /></label>
                  </>}
                <label className="check"><input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} /> Hẹn giờ nhận món</label>
                {scheduled && <label>Giờ nhận<input name="time" type="time" required /></label>}
                <label>Ghi chú<input name="note" placeholder="Ví dụ: ít cay, gọi trước khi giao…" /></label>

                <div className="pay">
                  <div className="cap">Thanh toán</div>
                  {([["cod", "Tiền mặt", "Trả khi nhận hàng"], ["bank", "Chuyển khoản", "Quét mã QR sau khi đặt"]] as const).map(([v, t, d], i) => (
                    <label key={v} className="pay-opt">
                      <input type="radio" name="payment" value={v} defaultChecked={i === 0} />
                      <span className="po"><b>{t}</b><small>{d}</small></span>
                    </label>
                  ))}
                </div>
              </form>
            </section>

            <aside className="cart-side" aria-label="Tóm tắt đơn hàng">
              <div className="box">
                <div className="cap">Ưu đãi</div>
                <div className="coupon">
                  <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Mã giảm giá" aria-label="Mã giảm giá" />
                  <button type="button" className="btn small ink" onClick={applyCoupon}>Áp dụng</button>
                </div>
                {couponMsg && <p className={applied ? "coupon-ok" : "error"}>{couponMsg}</p>}
                {vouchers.length > 0 ? (
                  <label className="voucher-pick">Voucher của bạn
                    <select value={voucherId} onChange={(e) => setVoucherId(e.target.value)}>
                      <option value="">— Không dùng voucher —</option>
                      {vouchers.map((v) => (
                        <option key={v.id} value={v.id}>
                          −{vnd(v.amount)} · đơn từ {vnd(v.min_order)} · HSD {new Date(v.expires_at).toLocaleDateString("vi-VN")}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="voucher-hint">Đổi điểm thưởng lấy voucher ở mục <Link href="/account">Tài khoản</Link>.</p>
                )}
                {voucher && !voucherOk && <p className="error">Voucher này áp dụng cho đơn từ {vnd(voucher.min_order)} (sau khi trừ mã giảm giá).</p>}
              </div>

              <div className="box">
                <div className="cap">Hình thức nhận hàng</div>
                <div className="seg" role="radiogroup" aria-label="Hình thức nhận hàng">
                  <button type="button" aria-pressed={!pickup} onClick={() => setPickup(false)}>Giao tận nơi</button>
                  <button type="button" aria-pressed={pickup} onClick={() => setPickup(true)}>Tự đến lấy</button>
                </div>
              </div>

              <div className="sumbox">
                <div className="cap">Tóm tắt đơn</div>
                <div><span>Tạm tính</span><span>{vnd(total)}</span></div>
                {discount > 0 && <div className="coupon-ok"><span>Giảm giá ({applied?.code})</span><span>−{vnd(discount)}</span></div>}
                {voucherDiscount > 0 && <div className="coupon-ok"><span>Voucher</span><span>−{vnd(voucherDiscount)}</span></div>}
                <div><span>Phí giao hàng</span><span>{ship ? vnd(ship) : "Miễn phí"}</span></div>
                <div className="grand"><span>Tổng cộng</span><span>{vnd(grand)}</span></div>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="btn place" type="submit" form="checkout" disabled={busy || !settings.is_open}>
                  {busy ? "Đang xử lý…" : `Đặt hàng · ${vnd(grand)}`}
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
      {editing && (
        <ProductModal
          product={editing.product}
          replace={{ key: editing.key, qty: editing.qty, picks: editing.picks, note: editing.note }}
          onClose={() => setEditing(null)}
        />
      )}
      <CartDrawer />
    </>
  );
}