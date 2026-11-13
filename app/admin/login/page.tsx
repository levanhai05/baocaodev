"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    if (error) { setBusy(false); setError("Email hoặc mật khẩu không đúng."); return; }
    const { data: a } = await supabase.from("admins").select("user_id").maybeSingle();
    if (a) { router.replace("/admin"); return; }
    const { data: s } = await supabase.from("staff").select("user_id").maybeSingle();
    if (s) { router.replace("/staff"); return; }
    await supabase.auth.signOut();
    setBusy(false);
    setError("Tài khoản này không có quyền quản trị hoặc nhân viên.");
  }

  return (
    <main className="login">
      <div className="login-box">
        <div className="logo"><span className="logo-mark"><LogoMark /></span> Phố Burger<i>.</i></div>
        <form onSubmit={submit}>
          <div className="eyebrow">Khu vực nội bộ</div>
          <h1>Đăng nhập nội bộ</h1>
          <p className="auth-sub">Dành cho quản trị viên và nhân viên.</p>
          <label>Email<input name="email" type="email" required autoComplete="username" placeholder="email@phoburger.vn" /></label>
          <label>Mật khẩu<input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập ↗"}</button>
        </form>
      </div>
    </main>
  );
}