import Link from "next/link";
import Header from "@/components/Header";
import Menu from "@/components/Menu";
import CartDrawer from "@/components/CartDrawer";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type Category, type Product, type Settings } from "@/lib/types";
import { BRAND, LogoMark } from "@/components/Logo";

export const revalidate = 60;
export const metadata = { title: "Toàn bộ thực đơn — Phố Burger" };

export default async function FullMenu() {
  const [c, p, s, r] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("products").select("*").order("id"),
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("reviews").select("product_id,rating"),
  ]);
  const categories = (c.data ?? []) as Category[];
  const products = ((p.data ?? []) as Product[]).filter((x) => x.is_available);
  const st: Settings = { ...DEFAULT_SETTINGS, ...(s.data ?? {}) };

  const agg: Record<number, { sum: number; count: number }> = {};
  ((r.data ?? []) as { product_id: number; rating: number }[]).forEach((x) => {
    const a = (agg[x.product_id] ??= { sum: 0, count: 0 }); a.sum += x.rating; a.count++;
  });
  const ratings = Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, { avg: v.sum / v.count, count: v.count }]));

  return (
    <>
      <Header />
      <main>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 24px 0" }}>
          <Link href="/#menu" className="link">← Về trang chủ</Link>
        </div>
        <Menu categories={categories} products={products} ratings={ratings} />
      </main>

      <footer className="site-foot">
        <div className="foot-grid">
          <div><div className="logo"><span className="logo-mark"><LogoMark /></span> {BRAND}<i>.</i></div><p style={{ maxWidth: 280, marginTop: 18 }}>Burger, gà rán và đồ uống làm nóng khi bạn đặt, giao tận nơi.</p></div>
          <div><h4>Khám phá</h4><p><Link href="/#menu">Thực đơn</Link></p><p><Link href="/track">Theo dõi đơn</Link></p><p><Link href="/stores">Cửa hàng</Link></p></div>
          <div><h4>Giờ mở cửa</h4><p>Mỗi ngày</p><p>9:00 – 22:00</p></div>
          <div><h4>Liên hệ</h4><p>Hotline: {st.hotline}</p><p>{st.address}</p></div>
        </div>
        <div className="foot-bottom"><span>© 2026 {BRAND}</span><span>Giao hàng nội thành</span></div>
      </footer>
      <CartDrawer />
    </>
  );
}