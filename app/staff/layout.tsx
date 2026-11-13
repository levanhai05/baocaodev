"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [denied, setDenied] = useState<"" | "denied" | "error">("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/admin/login"); return; }
      setEmail(session.user.email ?? "");
      const [a, s] = await Promise.all([
        supabase.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("staff").select("user_id").eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (a.error || s.error) { setDenied("error"); return; }   // lỗi mạng/DB: KHÔNG đăng xuất
      if (!a.data && !s.data) { setDenied("denied"); return; }
      setIsAdmin(!!a.data); setOk(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") router.replace("/admin/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (denied) {
    return (
      <main className="login">
        <div className="login-box">
          <div className="logo"><span className="logo-mark"><LogoMark /></span> Phố Burger<i>.</i></div>
          <div style={{ display: "grid", gap: 14 }}>
            <div className="eyebrow">{denied === "denied" ? "Không có quyền truy cập" : "Có lỗi xảy ra"}</div>
            <h1>{denied === "denied" ? "Tài khoản chưa được cấp quyền" : "Không kiểm tra được quyền"}</h1>
            <p className="auth-sub">
              {denied === "denied"
                ? <>Bạn đang đăng nhập bằng <b>{email}</b>, tài khoản này không phải quản trị viên hay nhân viên.</>
                : "Không đọc được dữ liệu phân quyền. Vui lòng kiểm tra kết nối rồi thử lại."}
            </p>
            {denied === "error"
              ? <button className="btn" onClick={() => location.reload()}>Thử lại</button>
              : <Link href="/" className="btn">Về trang chủ</Link>}
            <button className="link" onClick={async () => { await supabase.auth.signOut(); router.replace("/admin/login"); }}>
              Đăng xuất / đăng nhập tài khoản khác
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!ok) return <p className="notice" style={{ margin: "2rem" }}>Đang kiểm tra đăng nhập…</p>;
  return (
    <div className="staffwrap">
      <header className="staffbar">
        <b className="logo" style={{ fontSize: 18 }}><span className="logo-mark" style={{ width: 30, height: 30 }}><LogoMark size={18} /></span> Phố Burger · Xử lý đơn hàng</b>
        <nav>
          {isAdmin && <Link href="/admin">Trang quản trị</Link>}
          <button onClick={async () => { await supabase.auth.signOut(); router.replace("/admin/login"); }}>Đăng xuất</button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}