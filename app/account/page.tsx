"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { supabase } from "@/lib/supabase";
import AddressBook from "@/components/AddressBook";
import { PAY, PAY_STATUS, STATUS, vnd, type Order, type RewardTier, type Voucher } from "@/lib/types";
import "./account.css";

export default function Account() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [prof, setProf] = useState({ full_name: "", phone: "", address: "" });
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [points, setPoints] = useState(0);
  const [tiers, setTiers] = useState<RewardTier[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [rmsg, setRmsg] = useState<{ text: string; err?: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUid(session.user.id); setEmail(session.user.email ?? "");
      const [p, o, t, v] = await Promise.all([
        supabase.from("profiles").select("*").maybeSingle(),
        supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }),
        supabase.from("reward_tiers").select("*").eq("active", true).order("points"),
        supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
      ]);
      setTiers((t.data ?? []) as RewardTier[]);
      setVouchers((v.data ?? []) as Voucher[]);
      if (p.data) setPoints(p.data.points ?? 0);
      if (p.data) setProf({ full_name: p.data.full_name ?? "", phone: p.data.phone ?? "", address: p.data.address ?? "" });
      setOrders((o.data ?? []) as Order[]);
    })();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("profiles").upsert({ id: uid, ...prof });
    setSaving(false);
    setMsg(error ? { text: "Không lưu được: " + error.message, err: true } : { text: "✓ Đã lưu. Lần sau đặt hàng sẽ tự điền sẵn." });
  }

  async function redeem(t: RewardTier) {
    setRedeeming(t.id); setRmsg(null);
    const { data, error } = await supabase.rpc("redeem_points", { p_tier: t.id });
    setRedeeming(null);
    if (error || !data) {
      const m = error?.message ?? "";
      setRmsg({ err: true, text: m.includes("not_enough_points") ? "Bạn chưa đủ điểm để đổi mức này." : m.includes("not_logged_in") ? "Vui lòng đăng nhập lại." : "Không đổi được, vui lòng thử lại." });
      return;
    }
    setPoints((x) => x - t.points);
    setVouchers((vs) => [data as Voucher, ...vs]);
    setRmsg({ text: `✓ Đã đổi ${t.points} điểm lấy voucher ${vnd(t.amount)}. Chọn voucher này ở giỏ hàng khi đặt món.` });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!uid) return null;

  const name = prof.full_name.trim() || email.split("@")[0];
  const initial = (name.split(/\s+/).pop() ?? "?").charAt(0).toUpperCase();

  return (
    <>
      <Header />
      <main className="acc">
        <div className="acc-top">
          <span className="eyebrow">Khu vực thành viên</span>
          <h1>Tài khoản của tôi</h1>
        </div>

        <div className="acc-grid">
          <aside className="acc-side">
            <div className="acc-card acc-user">
              <div className="acc-avatar">{initial}</div>
              <h2>{name}</h2>
              <span className="mail">{email}</span>
              <button className="acc-logout" onClick={logout}>⎋ Đăng xuất</button>
            </div>
            <div className="acc-points">
              <small>Điểm thưởng</small>
              <strong>{points}</strong>
              <div className="val">Đổi điểm lấy voucher giảm giá ở mục bên phải</div>
              <p>Nhận 1 điểm mỗi 10.000đ khi đơn hoàn thành. Điểm dùng để đổi voucher, mỗi voucher dùng cho 1 đơn.</p>
            </div>
          </aside>

          <div className="acc-main">
            <section className="acc-card">
              <div className="acc-sec-h">
                <span className="acc-ic">🎟</span>
                <div><h2>Đổi điểm lấy voucher</h2><p>Bạn đang có {points} điểm.</p></div>
              </div>
              {tiers.length === 0 ? (
                <div className="acc-empty"><span>🎁</span>Hiện chưa có mức đổi điểm nào.</div>
              ) : (
                <div className="tier-list">
                  {tiers.map((t) => (
                    <div key={t.id} className="tier">
                      <strong>−{vnd(t.amount)}</strong>
                      <small>Đơn từ {vnd(t.min_order)} · dùng trong {t.valid_days} ngày</small>
                      <button className="btn small" disabled={points < t.points || redeeming !== null} onClick={() => redeem(t)}>
                        {redeeming === t.id ? "Đang đổi…" : `Đổi ${t.points} điểm`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {rmsg && <p className={"acc-msg" + (rmsg.err ? " err" : "")} role="status" style={{ marginTop: 14 }}>{rmsg.text}</p>}

              {vouchers.length > 0 && (
                <>
                  <h3 className="vc-title">Voucher của tôi</h3>
                  <ul className="vc-list">
                    {vouchers.map((v) => {
                      const expired = new Date(v.expires_at) < new Date();
                      const st = v.used_at ? "used" : expired ? "expired" : "ok";
                      return (
                        <li key={v.id} className={"vc " + st}>
                          <div><b>−{vnd(v.amount)}</b><small>Đơn từ {vnd(v.min_order)} · {v.code}</small></div>
                          <span>{st === "used" ? "Đã dùng" : st === "expired" ? "Hết hạn" : `HSD ${new Date(v.expires_at).toLocaleDateString("vi-VN")}`}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <section className="acc-card">
              <div className="acc-sec-h">
                <span className="acc-ic">☺</span>
                <div><h2>Thông tin giao hàng</h2><p>Tự động điền khi bạn đặt món.</p></div>
              </div>
              <form onSubmit={save} className="acc-form">
                <div className="acc-row">
                  <label>Họ tên<input value={prof.full_name} placeholder="Nguyễn Văn A" autoComplete="name" onChange={(e) => setProf({ ...prof, full_name: e.target.value })} /></label>
                  <label>Số điện thoại<input value={prof.phone} inputMode="tel" placeholder="0900 000 000" autoComplete="tel" onChange={(e) => setProf({ ...prof, phone: e.target.value })} /></label>
                </div>
                <label>Địa chỉ<input value={prof.address} placeholder="Số nhà, đường, phường/xã, quận/huyện" autoComplete="street-address" onChange={(e) => setProf({ ...prof, address: e.target.value })} /></label>
                <div className="acc-actions">
                  <button className="btn" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thông tin"}</button>
                  {msg && <span className={"acc-msg" + (msg.err ? " err" : "")} role="status">{msg.text}</span>}
                </div>
              </form>
            </section>

            <AddressBook uid={uid} />

            <section className="acc-card">
              <div className="acc-sec-h">
                <span className="acc-ic">▤</span>
                <div><h2>Đơn đã đặt</h2><p>Lịch sử và trạng thái đơn hàng của bạn.</p></div>
                {orders.length > 0 && <span className="acc-count">{orders.length}</span>}
              </div>
              {orders.length === 0 ? (
                <div className="acc-empty"><span>🍔</span>Bạn chưa có đơn nào. Đơn đặt khi đã đăng nhập sẽ hiện ở đây.</div>
              ) : (
                <div className="ord-list">
                  {orders.map((o) => (
                    <article key={o.id} className="ord">
                      <header className="ord-h">
                        <div className="ord-code">#{o.code}<span>{new Date(o.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span></div>
                        <span className={`ord-st st-${o.status}`}>{STATUS[o.status] ?? o.status}</span>
                      </header>
                      <ul className="ord-items">
                        {o.order_items.map((i) => (
                          <li key={i.id}>
                            <span className="q">×{i.qty}</span>
                            <span>{i.name}{i.options && <small>{i.options}</small>}</span>
                          </li>
                        ))}
                      </ul>
                      <footer className="ord-f">
                        <span className={`ord-pay ${o.payment_status}`}><i />{PAY[o.payment_method]} · {PAY_STATUS[o.payment_status]}</span>
                        <strong>{vnd(o.total)}</strong>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <CartDrawer />
    </>
  );
}