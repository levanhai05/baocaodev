"use client";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { bankQr } from "@/lib/payment";
import { PAY, PAY_STATUS, STATUS, vnd } from "@/lib/types";
import "./track.css";

const STEPS = ["new", "confirmed", "preparing", "delivering", "done"];

export default function Track() {
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("code") && codeRef.current) codeRef.current.value = q.get("code")!;
    setPaid(q.get("paid"));
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ph = String(f.get("phone"));
    setBusy(true); setError(""); setRes(null); setPhone(ph);
    const r = await fetch(`/api/track?code=${encodeURIComponent(String(f.get("code")))}&phone=${encodeURIComponent(ph)}`);
    const d = await r.json();
    setBusy(false);
    r.ok ? setRes(d) : setError(d.error);
  }

  async function payAgain() {
    const r = await fetch("/api/payment/vnpay", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: res.code, phone }),
    });
    const d = await r.json();
    r.ok ? (window.location.href = d.url) : setError(d.error);
  }

  const idx = res ? STEPS.indexOf(res.status) : -1;
  const unpaid = res && res.payment_status !== "paid" && res.status !== "cancelled";
  const qr = res && unpaid && res.payment_method === "bank" ? bankQr(res.code, res.total) : null;
  const subtotal = res ? res.order_items.reduce((s: number, i: any) => s + i.price * i.qty, 0) : 0;

  return (
    <>
      <Header />
      <main className="tk">
        <div className="tk-head">
          <span className="eyebrow">Theo dõi đơn hàng</span>
          <h1>Đơn của bạn đang ở đâu?</h1>
          <p>Nhập mã đơn và số điện thoại đã dùng khi đặt hàng để xem trạng thái mới nhất.</p>
        </div>

        {paid === "1" && <p className="tk-banner">✓ Thanh toán thành công. Cảm ơn bạn! Nhập số điện thoại để xem đơn.</p>}
        {paid === "0" && <p className="tk-banner bad">Thanh toán chưa thành công. Nhập số điện thoại để xem đơn và thanh toán lại.</p>}

        <form onSubmit={submit} className="tk-card tk-search">
          <label>Mã đơn<input ref={codeRef} name="code" required placeholder="VD: A1B2C3" autoComplete="off" /></label>
          <label>Số điện thoại đặt hàng<input name="phone" required inputMode="tel" placeholder="0900 000 000" /></label>
          <button className="btn" disabled={busy}>{busy ? "Đang tìm…" : "Tra cứu ↗"}</button>
        </form>
        {error && <p className="tk-err" role="alert">{error}</p>}

        {res && (
          <div className="tk-res">
            <section className="tk-card">
              <div className="tk-top">
                <div>
                  <small>Mã đơn</small>
                  <div className="tk-code">#{res.code}</div>
                  {res.created_at && <div className="tk-date">Đặt lúc {new Date(res.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>}
                </div>
                <span className={`tk-pill tk-st-${res.status}`}>{STATUS[res.status] ?? res.status}</span>
              </div>

              {res.status === "cancelled" ? (
                <div className="tk-cancel">Đơn này đã bị huỷ.</div>
              ) : (
                <div className="tk-steps">
                  <div className="tk-line"><i style={{ width: `${(Math.max(idx, 0) / (STEPS.length - 1)) * 100}%` }} /></div>
                  {STEPS.map((s, i) => {
                    const st = res.status === "done" || i < idx ? "done" : i === idx ? "now" : "todo";
                    return (
                      <div key={s} className={`tk-step ${st}`}>
                        <span className="tk-dot">{st === "done" ? "✓" : i + 1}</span>
                        {STATUS[s]}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="tk-cols">
              <section className="tk-card">
                <h2>Món đã đặt</h2>
                <ul className="tk-items">
                  {res.order_items.map((i: any, k: number) => (
                    <li key={k}>
                      <span className="nm">
                        <span className="q">×{i.qty}</span>
                        <span>{i.name}{i.options && <small>{i.options}</small>}{i.note && <small>Ghi chú: {i.note}</small>}</span>
                      </span>
                      <b>{vnd(i.price * i.qty)}</b>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="tk-card">
                <h2>Thanh toán</h2>
                <div className="tk-sum">
                  <div><span>Tạm tính</span><span>{vnd(subtotal)}</span></div>
                  {res.discount > 0 && <div className="off"><span>Giảm giá{res.coupon_code ? ` (${res.coupon_code})` : ""}</span><span>−{vnd(res.discount)}</span></div>}
                  {res.voucher_discount > 0 && <div className="off"><span>Voucher</span><span>−{vnd(res.voucher_discount)}</span></div>}
                  <div><span>Phí giao hàng</span><span>{res.shipping_fee ? vnd(res.shipping_fee) : "Miễn phí"}</span></div>
                  <div className="total"><span>Tổng cộng</span><span>{vnd(res.total)}</span></div>
                </div>
                <div className="tk-meta">
                  <div><small>Hình thức</small><span>{PAY[res.payment_method]}<b className={`tk-pay tk-pay-${res.payment_status}`}>{PAY_STATUS[res.payment_status]}</b></span></div>
                  <div><small>Giao đến</small><span>{res.address}</span></div>
                </div>
                {unpaid && res.payment_method === "vnpay" && <button className="btn tk-pay-btn" onClick={payAgain}>Thanh toán VNPay ↗</button>}
                {qr && (
                  <div className="tk-qr">
                    <span>Chuyển khoản với nội dung <b>Thanh toan don {res.code}</b></span>
                    <img src={qr} alt="Mã QR chuyển khoản" />
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
      <CartDrawer />
    </>
  );
}