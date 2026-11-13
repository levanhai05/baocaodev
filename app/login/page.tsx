"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    setBusy(true); setError(""); setInfo("");
    if (signup) {
      const full_name = String(f.get("full_name") ?? "").trim();
      const phone = String(f.get("phone") ?? "").trim();
      const address = String(f.get("address") ?? "").trim();
      if (password !== String(f.get("password2"))) { setBusy(false); setError("Mật khẩu nhập lại không khớp."); return; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, phone, address } } });
      if (error) { setBusy(false); setError(error.message.includes("registered") ? "Email này đã được đăng ký." : error.message); return; }
      if (data.session && data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, full_name, phone, address });
        setBusy(false);
        router.replace("/");
      } else {
        setBusy(false);
        setInfo("Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư rồi đăng nhập.");
      }
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) { setBusy(false); setError("Email hoặc mật khẩu không đúng."); return; }
    // Tài khoản quản trị / nhân viên không đăng nhập ở trang khách
    const [a, st] = await Promise.all([
      supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle(),
      supabase.from("staff").select("user_id").eq("user_id", data.user.id).maybeSingle(),
    ]);
    if (a.data || st.data) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("Đây là tài khoản quản trị/nhân viên. Vui lòng đăng nhập ở trang quản trị (/admin/login).");
      return;
    }
    // Lần đăng nhập đầu sau khi xác nhận email: chép thông tin đã nhập lúc đăng ký vào hồ sơ
    const meta = (data.user.user_metadata ?? {}) as { full_name?: string; phone?: string; address?: string };
    if (meta.full_name || meta.phone || meta.address) {
      const { data: p } = await supabase.from("profiles").select("full_name,phone,address").eq("id", data.user.id).maybeSingle();
      if (!p?.full_name && !p?.phone && !p?.address)
        await supabase.from("profiles").upsert({ id: data.user.id, full_name: meta.full_name ?? "", phone: meta.phone ?? "", address: meta.address ?? "" });
    }
    setBusy(false);
    router.replace("/");
  }

  async function forgot() {
    if (!email) { setError("Nhập email của bạn rồi bấm lại."); return; }
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) setError(error.message); else setInfo("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.");
  }

  const switchMode = (v: boolean) => { setSignup(v); setError(""); setInfo(""); };

  return (
    <>
      <Header />
      <main className="auth">
        <aside className="auth-side">
          <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&q=85" alt="" />
          <div className="auth-side-in">
            <div className="eyebrow">Thành viên Phố Burger</div>
            <h2>Ăn ngon, tích điểm,<br />đổi quà.</h2>
            <ul>
              <li><b>1 điểm</b> cho mỗi 10.000đ khi đơn hoàn thành</li>
              <li><b>Lưu địa chỉ</b> để đặt món chỉ vài chạm</li>
              <li><b>Theo dõi</b> lịch sử và trạng thái đơn hàng</li>
            </ul>
          </div>
        </aside>
        <section className="auth-main">
          <div className="auth-card">
            <div className="seg" role="tablist" aria-label="Chế độ">
              <button type="button" aria-pressed={!signup} onClick={() => switchMode(false)}>Đăng nhập</button>
              <button type="button" aria-pressed={signup} onClick={() => switchMode(true)}>Đăng ký</button>
            </div>
            <h1>{signup ? "Tạo tài khoản" : "Chào mừng quay lại"}</h1>
            <p className="auth-sub">{signup ? "Đăng ký để tích điểm và đặt món nhanh hơn." : "Đăng nhập để tiếp tục đặt món."}</p>
            <form onSubmit={submit}>
              {signup && <label>Họ và tên<input name="full_name" required autoComplete="name" placeholder="Nguyễn Văn A" /></label>}
              <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="ban@email.com" /></label>
              {signup && <label>Số điện thoại<input name="phone" type="tel" inputMode="tel" required pattern="[0-9+ ]{9,13}" title="Nhập 9–13 chữ số" autoComplete="tel" placeholder="0900 000 000" /></label>}
              {signup && <label>Địa chỉ giao hàng (không bắt buộc)<input name="address" autoComplete="street-address" placeholder="Số nhà, đường, phường/xã, quận/huyện" /></label>}
              <label>Mật khẩu<input name="password" type="password" required minLength={6} autoComplete={signup ? "new-password" : "current-password"} placeholder="Tối thiểu 6 ký tự" /></label>
              {signup && <label>Nhập lại mật khẩu<input name="password2" type="password" required minLength={6} autoComplete="new-password" placeholder="Nhập lại mật khẩu" /></label>}
              {error && <p className="error" role="alert">{error}</p>}
              {info && <p className="notice" role="status">{info}</p>}
              <button className="btn" disabled={busy}>{busy ? "Đang xử lý…" : signup ? "Đăng ký" : "Đăng nhập"} {!busy && "↗"}</button>
            </form>
            <div className="auth-links">
              {!signup && <button className="link" onClick={forgot}>Quên mật khẩu?</button>}
              <button className="link" onClick={() => switchMode(!signup)}>
                {signup ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
              </button>
            </div>
          </div>
        </section>
      </main>
      <CartDrawer />
    </>
  );
}