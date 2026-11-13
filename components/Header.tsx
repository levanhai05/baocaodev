"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import { supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";

export default function Header() {
  const { count } = useCart();
  const router = useRouter();
  const [user, setUser] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="top">
      <Link href="/" className="logo"><span className="logo-mark"><LogoMark /></span> Phố Burger<i>.</i></Link>
      <nav>
        <Link href="/#menu">Thực đơn</Link>
        <Link href="/#story">Câu chuyện</Link>
        <Link href="/stores">Cửa hàng</Link>
        <Link href="/track">Theo dõi đơn</Link>
        <Link href={user ? "/account" : "/login"}>{user ? "Tài khoản" : "Đăng nhập"}</Link>
        {user && <NotificationBell />}
        {user && (
          <button
            type="button"
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            style={{ background: "none", border: 0, padding: 6, cursor: "pointer", color: "#5b5e5d", display: "grid", placeItems: "center" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--orange)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#5b5e5d")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
        <Link href="/cart" className="btn small ink">Giỏ hàng ({count}) ↗</Link>
      </nav>
    </header>
  );
}