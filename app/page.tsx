import Link from "next/link";
import Header from "@/components/Header";
import Menu from "@/components/Menu";
import CartDrawer from "@/components/CartDrawer";
import ProductCard from "@/components/ProductCard";
import PromoBanner from "@/components/PromoBanner";
import { supabase } from "@/lib/supabase";
import { service } from "@/lib/server";
import { couponParts, type CouponRow } from "@/lib/coupon";
import { DEFAULT_SETTINGS, onSale, stars, type Category, type Product, type Settings } from "@/lib/types";
import { BRAND, LogoMark } from "@/components/Logo";
import GoldenHour, { DealTimer } from "@/components/GoldenHour";
import WeekendDeal from "@/components/WeekendDeal";
import ChatBot from "@/components/ChatBot";

export const revalidate = 60;

export default async function Home() {
  const [c, p, s, r, cp] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("products").select("*").order("id"),
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("reviews").select("product_id,rating,author,comment,created_at").order("created_at", { ascending: false }),
    // Mã đang bật và được phép hiện trên trang chủ (đọc bằng service-role vì bảng coupons chỉ cho admin đọc)
    service().from("coupons").select("code,percent,amount,min_order,max_discount,expires_at").eq("active", true).eq("show_home", true).order("created_at", { ascending: false }),
  ]);
  const categories = (c.data ?? []) as Category[];
  const products = ((p.data ?? []) as Product[]).filter((x) => x.is_available);
  const st: Settings = { ...DEFAULT_SETTINGS, ...(s.data ?? {}) };
  const promos = ((cp.data ?? []) as CouponRow[]).filter((x) => !x.expires_at || new Date(x.expires_at).getTime() > Date.now()).slice(0, 5).map(couponParts);
  const announce: React.ReactNode[] = [...(st.banner_text ? [st.banner_text] : []), ...promos.map((x) => <>Mã <b>{x.code}</b> {x.rest}</>)];
  const announceRun = announce.length ? Array.from({ length: Math.ceil(6 / announce.length) }, () => announce).flat() : [];

  const agg: Record<number, { sum: number; count: number }> = {};
  type Rv = { product_id: number; rating: number; author: string | null; comment: string | null; created_at: string };
  const allReviews = (r.data ?? []) as Rv[];
  allReviews.forEach((x) => {
    const a = (agg[x.product_id] ??= { sum: 0, count: 0 }); a.sum += x.rating; a.count++;
  });
  const ratings = Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, { avg: v.sum / v.count, count: v.count }]));

  const voices = allReviews
    .filter((x) => x.rating >= 4 && (x.comment ?? "").trim().length >= 10)
    .slice(0, 3)
    .map((x) => ({ ...x, dish: products.find((p) => p.id === x.product_id)?.name }));
  const marquee = [...promos.map((x) => `Mã ${x.code}: ${x.rest}`), "Burger bò nướng", "Gà rán 11 vị", "Khoai chiên giòn", "Làm nóng khi đặt", "Giao trong 30 phút", `Freeship từ ${st.free_ship_from.toLocaleString("vi-VN")}đ`];
  const faqs: [string, string][] = [
    ["Bao lâu thì nhận được món?", "Đơn nội thành thường giao trong khoảng 30 phút. Món được làm sau khi bạn đặt nên giờ cao điểm có thể lâu hơn một chút, bạn theo dõi được tiến độ ở mục Theo dõi đơn."],
    ["Phí giao hàng tính thế nào?", `Phí giao là ${st.ship_fee.toLocaleString("vi-VN")}đ, và miễn phí cho đơn từ ${st.free_ship_from.toLocaleString("vi-VN")}đ.`],
    ["Có những cách thanh toán nào?", "Bạn có thể trả tiền mặt khi nhận hàng hoặc chuyển khoản bằng mã QR."],
    ["Tôi có thể tự đến lấy hoặc hẹn giờ không?", "Được. Khi đặt hàng bạn chọn nhận tại cửa hàng hoặc chọn giờ giao mong muốn."],
    ["Điểm thưởng dùng như thế nào?", "Mỗi 10.000đ bạn nhận 1 điểm, và 1 điểm đổi được 1.000đ cho đơn sau. Xem điểm của bạn trong mục Tài khoản."],
  ];
  const comboId = categories.find((x) => x.name.toLowerCase().includes("combo"))?.id;
  const best = products.filter((x) => x.is_hot && x.category_id !== comboId).slice(0, 4);
  const deals = products.filter((x) => onSale(x)).slice(0, 4);
  const dealEnds = deals.map((x) => (x.sale_until ? new Date(x.sale_until).getTime() : Infinity));
  const sameEnd = dealEnds.length > 0 && Number.isFinite(dealEnds[0]) && dealEnds.every((e) => e === dealEnds[0]);
  const dealsUntil = sameEnd ? new Date(dealEnds[0]).toISOString() : null; // chỉ hiện đồng hồ lớn khi tất cả cùng giờ kết thúc
  const combos = products.filter((x) => comboId && x.category_id === comboId).slice(0, 4);
  const shelf = (title: React.ReactNode, eyebrow: string, list: Product[]) => list.length > 0 && (
    <section className="shelf">
      <span className="eyebrow">{eyebrow}</span>
      <div className="menu-titlerow"><h2 className="sec-title">{title}</h2><span className="menu-count">{list.length} món</span></div>
      <div className="grid">{list.map((x) => <ProductCard key={x.id} product={x} rating={ratings[x.id]} />)}</div>
    </section>
  );

  return (
    <>
      {!st.is_open ? (
        <div className="announce">Cửa hàng đang tạm đóng cửa. Bạn vẫn xem được thực đơn, vui lòng quay lại sau.</div>
      ) : promos.length > 0 ? (
        <div className="announce run">
          <div className="announce-track">
            {[0, 1].map((k) => <div key={k} className="announce-set" aria-hidden={k === 1}>{announceRun.map((m, i) => <span key={i}>{m}<i>✦</i></span>)}</div>)}
          </div>
        </div>
      ) : st.banner_text ? (
        <div className="announce">{st.banner_text}</div>
      ) : null}
      <Header />
      <main>
        <section className="hero">
          <div className="hero-photo"><img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=90" alt="Burger bò với rau tươi" /></div>
          <div className="hero-copy">
            <span className="pill"><i />{st.is_open ? "Đang nhận đơn" : "Tạm đóng cửa"}</span>
            <div className="eyebrow">Made with love, served with joy</div>
            <h1>Chạm vị ngon.<br /><em>Trọn niềm vui.</em></h1>
            <p>Bánh mì mềm thơm, thịt nướng đậm vị, rau tươi mỗi ngày. Làm ngay khi bạn đặt: burger bò nướng, gà rán tẩm 11 loại gia vị, khoai chiên vàng giòn.</p>
            <div className="hero-cta">
              <a href="#menu" className="btn">KHÁM PHÁ THỰC ĐƠN ↗</a>
              <Link href="/track" className="btn ghost">Theo dõi đơn</Link>
            </div>
            <ul className="hero-points">
              <li><b>30 phút</b>Giao nội thành</li>
              <li><b>0đ ship</b>Đơn từ {st.free_ship_from.toLocaleString("vi-VN")}đ</li>
              <li><b>2 cách</b>Tiền mặt · QR</li>
            </ul>
          </div>
          <div className="hero-tag"><small>GIAO NHANH</small><strong>30&apos;</strong><small>Nội thành · làm nóng khi đặt</small></div>
        </section>

        <div className="strip"><div className="strip-in">
          <div className="strip-item"><span className="ic">♨</span><div><strong>Nóng hổi mỗi ngày</strong><small>Chế biến sau khi đặt</small></div></div>
          <div className="strip-item"><span className="ic">☘</span><div><strong>Nguyên liệu tươi</strong><small>Lựa chọn kỹ càng</small></div></div>
          <div className="strip-item"><span className="ic">⚡</span><div><strong>Đặt món nhanh chóng</strong><small>Chỉ một vài thao tác</small></div></div>
          <div className="strip-item"><span className="ic">♡</span><div><strong>Chất lượng tận tâm</strong><small>Chuẩn vị từng miếng</small></div></div>
        </div></div>

        <div className="ribbon" aria-hidden="true">
          <div className="ribbon-track">
            {[0, 1].map((k) => <div key={k} className="ribbon-set">{marquee.map((m, i) => <span key={i}>{m}<i>✦</i></span>)}</div>)}
          </div>
        </div>

        {shelf(<>Món <em>bán chạy</em></>, "Được yêu thích nhất", best)}
        {deals.length > 0 && (
          <section className="shelf golden">
            <GoldenHour until={dealsUntil} />
            <div className="grid">{deals.map((x) => (
              <div key={x.id} className="gh-card">
                <ProductCard product={x} rating={ratings[x.id]} />
                {!sameEnd && x.sale_until && <DealTimer until={x.sale_until} />}
              </div>
            ))}</div>
          </section>
        )}
        <WeekendDeal />
        {shelf(<>Combo <em>nổi bật</em></>, "Tiết kiệm hơn khi đi nhóm", combos)}

        <Menu categories={categories} products={products} ratings={ratings} />

        <section className="about" id="story">
          <div>
            <span className="eyebrow">More than just a burger · Về {BRAND}</span>
            <h2 className="sec-title">Ăn ngon là một cách <em>yêu bản thân.</em></h2>
            <p>Chúng tôi chọn bò xay mỗi ngày, gà tươi tẩm ướp 11 loại gia vị và khoai cắt tại bếp. Mỗi phần ăn được làm sau khi nhận đơn để giữ độ nóng giòn trọn vẹn khi đến tay bạn.</p>
            <ul className="hero-points">
              <li><b>100%</b>Nguyên liệu trong ngày</li>
              <li><b>11 vị</b>Gia vị gà rán</li>
              <li><b>30 phút</b>Giao nội thành</li>
            </ul>
          </div>
          <img className="about-img" src="https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&q=85" alt="Burger hảo hạng" />
        </section>

        <section className="how" id="how">
          <span className="eyebrow">As easy as 1, 2, 3</span>
          <h2 className="sec-title" style={{ marginBottom: 0 }}>Đặt ngon. <em>Ăn vui.</em></h2>
          <div className="steps3">
            <div className="card3"><div className="n">01 — KHÁM PHÁ</div><h3>Chọn món yêu thích</h3><p>Chọn burger, combo và món ăn kèm phù hợp với khẩu vị của bạn.</p></div>
            <div className="card3"><div className="n">02 — ĐẶT HÀNG</div><h3>Thêm vào giỏ hàng</h3><p>Kiểm tra lại đơn, chọn phương thức thanh toán và xác nhận đặt món.</p></div>
            <div className="card3"><div className="n">03 — THƯỞNG THỨC</div><h3>Chờ món ngon đến</h3><p>Thư giãn trong lúc đội ngũ chuẩn bị đơn hàng của bạn thật chu đáo.</p></div>
          </div>
        </section>

        {voices.length > 0 && (
          <section className="voices">
            <span className="eyebrow">Khách nói gì về {BRAND}</span>
            <h2 className="sec-title">Ăn rồi <em>mới biết.</em></h2>
            <div className="voice-grid">
              {voices.map((v, i) => (
                <figure key={i} className="voice">
                  <div className="stars">{stars(v.rating)}</div>
                  <blockquote>{v.comment}</blockquote>
                  <figcaption><b>{v.author || "Khách hàng"}</b>{v.dish && <small>đã thử {v.dish}</small>}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="faq">
          <span className="eyebrow">Hỏi nhanh đáp gọn</span>
          <h2 className="sec-title">Có <em>thắc mắc?</em></h2>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <PromoBanner freeShipFrom={st.free_ship_from} />
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
      <ChatBot products={products} categories={categories} shipFee={st.ship_fee} freeShipFrom={st.free_ship_from} />
    </>
  );
}