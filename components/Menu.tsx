"use client";
import { useState } from "react";
import ProductCard from "./ProductCard";
import { useCart } from "./CartProvider";
import { effectivePrice, type Category, type Product } from "@/lib/types";

type Ratings = Record<number, { avg: number; count: number }>;

export default function Menu({ categories, products, ratings }: { categories: Category[]; products: Product[]; ratings: Ratings }) {
  const [cat, setCat] = useState<number | "fav" | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("default");
  const [range, setRange] = useState("all");
  const { favs } = useCart();

  const inRange = (n: number) => range === "all" || (range === "lt50" ? n < 50000 : range === "mid" ? n >= 50000 && n <= 100000 : n > 100000);
  const list = products
    .filter((p) => p.is_available && (cat === null || (cat === "fav" ? favs.includes(p.id) : p.category_id === cat))
      && p.name.toLowerCase().includes(q.toLowerCase()) && inRange(effectivePrice(p)))
    .sort((a, b) => sort === "asc" ? effectivePrice(a) - effectivePrice(b) : sort === "desc" ? effectivePrice(b) - effectivePrice(a) : a.id - b.id);

  return (
    <section id="menu" className="menu">
      <span className="eyebrow gh-eyebrow">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s1 3.5-1.5 6C8 10.5 6 12.5 6 15.5A6 6 0 0 0 18 15.5c0-2-1-3.5-2-4.5 0 1.5-.8 2.5-1.8 2.5C15 10 14 5 12 2Z" fill="currentColor"/><path d="M12 22a3.2 3.2 0 0 1-3.2-3.2c0-1.6 1.4-2.6 2.2-4 .3 1 1 1.4 1.6 1.4.9 0 1.7.9 1.7 2.2A2.9 2.9 0 0 1 12 22Z" fill="#ffd23f"/></svg>
        The people&apos;s favorites
      </span>
      <div className="menu-titlerow">
        <h2>Thực <em>đơn</em></h2>
        <span className="menu-count">{list.length} món</span>
      </div>
      <p className="menu-sub">Chọn món yêu thích – làm nóng ngay khi bạn đặt, giao tận nơi.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={cat === null} onClick={() => setCat(null)}>Tất cả</button>
        {categories.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>
        ))}
        {favs.length > 0 && <button role="tab" aria-selected={cat === "fav"} onClick={() => setCat("fav")}>♥ Yêu thích</button>}
        <select className="sortsel" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Lọc theo giá">
          <option value="all">Mọi mức giá</option>
          <option value="lt50">Dưới 50.000đ</option>
          <option value="mid">50.000đ – 100.000đ</option>
          <option value="gt100">Trên 100.000đ</option>
        </select>
        <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp">
          <option value="default">Mặc định</option>
          <option value="asc">Giá thấp → cao</option>
          <option value="desc">Giá cao → thấp</option>
        </select>
        <input className="search" placeholder="Tìm món…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm món" />
      </div>
      <div className="grid">
        {list.map((p) => <ProductCard key={p.id} product={p} rating={ratings[p.id]} />)}
        {list.length === 0 && <p>Không tìm thấy món phù hợp.</p>}
      </div>
    </section>
  );
}