"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";
type State = "check" | "ok" | "denied" | "error";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [state, setState] = useState<State>("check");
  const [email, setEmail] = useState("");
  const isLogin = path === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    let alive = true;
    setState("check");
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      if (!session) { router.replace("/admin/login"); return; }
      setEmail(session.user.email ?? "");

      const a = await supabase.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!alive) return;
      if (a.error) { setState("error"); return; }       // lỗi mạng/DB: KHÔNG đăng xuất
      if (a.data) { setState("ok"); return; }

      const s = await supabase.from("staff").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!alive) return;
      if (s.error) { setState("error"); return; }
      if (s.data) { router.replace("/staff"); return; }
      setState("denied");                                 // đang đăng nhập nhưng không phải admin/nhân viên
    })();

    // Đăng xuất ở tab khác thì chuyển về trang đăng nhập
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") router.replace("/admin/login");
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (state === "check") return <p className="notice" style={{ margin: "2rem" }}>Đang kiểm tra đăng nhập…</p>;

  if (state === "error" || state === "denied") {
    return (
      <main className="login">
        <div className="login-box">
          <div className="logo"><span className="logo-mark"><LogoMark /></span> Phố Burger<i>.</i></div>
          <div style={{ display: "grid", gap: 14 }}>
            <div className="eyebrow">{state === "denied" ? "Không có quyền truy cập" : "Có lỗi xảy ra"}</div>
            <h1>{state === "denied" ? "Tài khoản chưa được cấp quyền" : "Không kiểm tra được quyền"}</h1>
            <p className="auth-sub">
              {state === "denied"
                ? <>Bạn đang đăng nhập bằng <b>{email}</b>, tài khoản này không phải quản trị viên hay nhân viên.</>
                : "Không đọc được dữ liệu phân quyền. Vui lòng kiểm tra kết nối rồi thử lại."}
            </p>
            {state === "error"
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

  return (
    <div className="admin">
      <aside>
        <div className="logo"><span className="logo-mark"><LogoMark /></span> Phố Burger<i>.</i></div>
        <div className="navcap">MAIN WORKSPACE</div>
        <Link href="/admin/dashboard" className={path === "/admin/dashboard" ? "on" : ""}><span>▦</span>Tổng quan</Link>
        <Link href="/admin" className={path === "/admin" ? "on" : ""}><span>▤</span>Đơn hàng</Link>
        <Link href="/admin/products" className={path === "/admin/products" ? "on" : ""}><span>◈</span>Món & danh mục</Link>
        <Link href="/admin/photos" className={path === "/admin/photos" ? "on" : ""}><span>▧</span>Ảnh món</Link>
        <Link href="/admin/coupons" className={path === "/admin/coupons" ? "on" : ""}><span>◇</span>Mã giảm giá</Link>
        <Link href="/admin/staff" className={path === "/admin/staff" ? "on" : ""}><span>♙</span>Nhân viên</Link>
        <Link href="/admin/payments" className={path === "/admin/payments" ? "on" : ""}><span>▣</span>Thanh toán</Link>
        <Link href="/admin/stores" className={path === "/admin/stores" ? "on" : ""}><span>⌂</span>Cửa hàng</Link>
        <Link href="/admin/customers" className={path === "/admin/customers" ? "on" : ""}><span>♧</span>Khách hàng</Link>
        <Link href="/admin/reviews" className={path === "/admin/reviews" ? "on" : ""}><span>☆</span>Đánh giá</Link>
        <Link href="/admin/settings" className={path === "/admin/settings" ? "on" : ""}><span>⚙</span>Cài đặt</Link>
        <div className="navcap">ĐIỀU HƯỚNG</div>
        <Link href="/staff"><span>↗</span>Bảng xử lý đơn</Link>
        <Link href="/"><span>↗</span>Xem website</Link>
        <button onClick={async () => { await supabase.auth.signOut(); router.replace("/admin/login"); }}><span>⎋</span>Đăng xuất</button>
      </aside>
      <section>{children}</section>
    </div>
  );
}