"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";

declare global { interface Window { google?: any } }

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Login() {
  const router = useRouter();
  const btn = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkRole(userId: string) {
    const { data: a } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (a) { router.replace("/admin"); return; }
    const { data: s } = await supabase.from("staff").select("user_id").eq("user_id", userId).maybeSingle();
    if (s) { router.replace("/staff"); return; }
    await supabase.auth.signOut();
    setBusy(false);
    setError("Tài khoản Google này không có quyền quản trị hoặc nhân viên.");
  }

  // Đã có phiên sẵn -> kiểm tra quyền luôn
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setBusy(true); await checkRole(session.user.id); }
    })();
  }, []);

  // Khi thư viện Google tải xong -> vẽ nút đăng nhập
  useEffect(() => {
    if (!ready || !btn.current) return;
    if (!CLIENT_ID) { setError("Thiếu biến NEXT_PUBLIC_GOOGLE_CLIENT_ID."); return; }
    if (!window.crypto?.subtle) { setError("Trang cần chạy trên HTTPS (hoặc localhost) để đăng nhập Google."); return; }
    (async () => {
      const raw = crypto.randomUUID();
      const hashed = await sha256Hex(raw);
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: hashed,
        callback: async (res: { credential: string }) => {
          setBusy(true); setError("");
          const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: res.credential, nonce: raw });
          if (error || !data.user) { setBusy(false); setError("Đăng nhập Google thất bại, vui lòng thử lại."); return; }
          await checkRole(data.user.id);
        },
      });
      window.google.accounts.id.renderButton(btn.current, { theme: "filled_black", size: "large", shape: "rectangular", text: "signin_with", width: 340 });
    })();
  }, [ready]);

  return (
    <main className="login">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div className="login-box">
        <div className="logo"><span className="logo-mark"><LogoMark /></span> Phố Burger<i>.</i></div>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="eyebrow">Khu vực nội bộ</div>
          <h1>Đăng nhập nội bộ</h1>
          <p className="auth-sub">Dành cho quản trị viên và nhân viên. Đăng nhập bằng tài khoản Google đã được cấp quyền.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div ref={btn} style={{ display: "flex", justifyContent: "center", opacity: busy ? 0.5 : 1, pointerEvents: busy ? "none" : "auto" }} />
          {busy && <p className="auth-sub" style={{ textAlign: "center" }}>Đang xử lý…</p>}
        </form>
      </div>
    </main>
  );
}