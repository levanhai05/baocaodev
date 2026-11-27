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

type Bill = {
  name: string; phone: string; address: string; note: string; pickup: boolean; at: string;
  items: { name: string; label: string; qty: number; unit: number }[];
  subtotal: number; discount: number; voucher: number; ship: number;
};

function renderBill(code: string, total: number, payment: string, b: Bill, shopAddr: string): string {
  const W = 480, P = 24, S = 2, FONT = "Arial, sans-serif";
  const draw = (ctx: CanvasRenderingContext2D, H: number | null) => {
    let y = P;
    const font = (w: string, sz: number) => { ctx.font = `${w} ${sz}px ${FONT}`; };
    const wrap = (t: string, max: number) => {
      const out: string[] = []; let cur = "";
      for (const word of t.split(" ")) {
        const test = cur ? cur + " " + word : word;
        if (ctx.measureText(test).width > max && cur) { out.push(cur); cur = word; } else cur = test;
      }
      if (cur) out.push(cur);
      return out;
    };
    const center = (t: string, sz: number, w = "normal") => {
      font(w, sz); ctx.textAlign = "center";
      wrap(t, W - 2 * P).forEach((l) => { y += sz + 6; if (H) ctx.fillText(l, W / 2, y); });
    };
    const row = (l: string, r: string, sz = 15, w = "normal") => {
      font(w, sz); y += sz + 8;
      if (H) { ctx.textAlign = "left"; ctx.fillText(l, P, y); ctx.textAlign = "right"; ctx.fillText(r, W - P, y); }
    };
    const text = (t: string, sz = 14, color = "#000") => {
      font("normal", sz); ctx.textAlign = "left";
      wrap(t, W - 2 * P).forEach((l) => { y += sz + 6; if (H) { ctx.fillStyle = color; ctx.fillText(l, P, y); ctx.fillStyle = "#000"; } });
    };
    const hr = () => {
      y += 8;
      if (H) { ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W - P, y); ctx.stroke(); }
      y += 8;
    };

    if (H) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#000"; ctx.strokeStyle = "#999"; ctx.textBaseline = "alphabetic"; }
    center("PHỐ BURGER", 26, "bold");
    if (shopAddr) center(shopAddr, 13);
    hr();
    center("HÓA ĐƠN", 18, "bold");
    center(`Mã đơn: ${code}`, 16, "bold");
    center(b.at, 13);
    hr();
    text(`Khách: ${b.name}`); text(`SĐT: ${b.phone}`);
    text(b.pickup ? "Tự đến lấy" : `Giao đến: ${b.address}`);
    if (b.note) text(`Ghi chú: ${b.note}`);
    hr();
    for (const i of b.items) {
      font("bold", 15);
      const names = wrap(i.name, W - 2 * P - 110);
      names.forEach((n, k) => {
        y += 21;
        if (H) { ctx.textAlign = "left"; ctx.fillText(n, P, y); if (k === 0) { ctx.textAlign = "right"; ctx.fillText(vnd(i.qty * i.unit), W - P, y); } }
      });
      text(`${i.qty} × ${vnd(i.unit)}${i.label ? " · " + i.label : ""}`, 13, "#555");
    }
    hr();
    row("Tạm tính", vnd(b.subtotal));
    if (b.discount > 0) row("Giảm giá", `−${vnd(b.discount)}`);
    if (b.voucher > 0) row("Voucher", `−${vnd(b.voucher)}`);
    row("Phí giao hàng", b.ship ? vnd(b.ship) : "Miễn phí");
    row("TỔNG CỘNG", vnd(total), 18, "bold");
    row("Thanh toán", payment === "bank" ? "Chuyển khoản" : "Tiền mặt (COD)");
    hr();
    center("Cảm ơn quý khách! Hẹn gặp lại 🍔", 14);
    return y + P;
  };

  const H = Math.ceil(draw(document.createElement("canvas").getContext("2d")!, null));
  const cv = document.createElement("canvas");
  cv.width = W * S; cv.height = H * S;
  const ctx = cv.getContext("2d")!;
  ctx.scale(S, S);
  draw(ctx, H);
  return cv.toDataURL("image/png");
}

// Gửi kèm token đăng nhập để server biết khách này đã dùng mã chưa
async function authFetch(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, session ? { headers: { Authorization: `Bearer ${session.access_token}` } } : undefined);
}

export default function CartPage() {
  const { lines, count, total, settings, change, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ code: string; total: number; payment: string; bill: Bill } | null>(null);
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
    setDone({
      code: data.code, total: data.total, payment,
      bill: {
        name: String(f.get("name") ?? ""), phone, address: String(f.get("address") ?? ""), note: String(f.get("note") ?? ""),
        pickup, at: new Date().toLocaleString("vi-VN"),
        items: lines.map((l) => ({ name: l.product.name, label: l.label, qty: l.qty, unit: unitOf(l) })),
        subtotal: total, discount, voucher: voucherDiscount, ship,
      },
    });
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
              <button type="button" className="btn ghost" onClick={() => setPreview(renderBill(done.code, done.total, done.payment, done.bill, settings.address))}>Xem hóa đơn 🧾</button>
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
      {preview && done && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 16, maxHeight: "92vh", display: "flex", flexDirection: "column", gap: 12, maxWidth: 420, width: "100%" }}>
            <div style={{ overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
              <img src={preview} alt={`Hóa đơn ${done.code}`} style={{ width: "100%", display: "block" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" style={{ color: "#1a1a1a", borderColor: "#d5d3cc" }} onClick={() => setPreview(null)}>Đóng</button>
              <a className="btn" href={preview} download={`hoa-don-${done.code}.png`}>Tải về ⬇</a>
            </div>
          </div>
        </div>
      )}
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