"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password: String(new FormData(e.currentTarget).get("password")) });
    setBusy(false);
    if (error) { setMsg("Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu gửi lại email đặt lại mật khẩu."); return; }
    router.replace("/account");
  }

  return (
    <>
      <Header />
      <main className="page">
        <h1>Đặt lại mật khẩu</h1>
        <form onSubmit={submit} className="track-form">
          <label>Mật khẩu mới<input name="password" type="password" required minLength={6} autoComplete="new-password" /></label>
          {msg && <p className="error" role="alert">{msg}</p>}
          <button className="btn" disabled={busy}>{busy ? "Đang lưu…" : "Lưu mật khẩu"}</button>
        </form>
      </main>
    </>
  );
}
