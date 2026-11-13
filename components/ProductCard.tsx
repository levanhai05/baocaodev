"use client";
import { useState } from "react";
import { useCart } from "./CartProvider";
import ProductModal from "./ProductModal";
import { effectivePrice, onSale, stars, vnd, type Product } from "@/lib/types";

export default function ProductCard({ product: p, rating }: { product: Product; rating?: { avg: number; count: number } }) {
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const { favs, toggleFav, qtyOf } = useCart();
  const inCart = qtyOf(p.id);
  const sale = onSale(p);
  const fav = favs.includes(p.id);
  return (
    <>
      <article className="item" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(true); }}>
        <button className="heart" onClick={(e) => { e.stopPropagation(); toggleFav(p.id); }} aria-label="Yêu thích" aria-pressed={fav}>{fav ? "♥" : "♡"}</button>
        {sale && (
          <div className="item-tags">
            <span className="saletag">-{Math.round((1 - effectivePrice(p) / p.price) * 100)}%</span>
          </div>
        )}
        <div className="item-art">
          {p.image_url && !bad ? <img src={p.image_url} alt={p.name} loading="lazy" onError={() => setBad(true)} /> : <span aria-hidden>{p.emoji}</span>}
          {p.is_hot && <span className="hot item-hot">Bán chạy</span>}
        </div>
        <div className="item-body">
          <h3>{p.name}</h3>
          {rating && <p className="stars">{stars(rating.avg)} <small>{rating.avg.toFixed(1)} ({rating.count})</small></p>}
          <p>{p.description}</p>
          <div className="item-foot">
            <div className="price">{sale && <s>{vnd(p.price)}</s>}<strong>{vnd(effectivePrice(p))}</strong></div>
            <span className={"go" + (inCart > 0 ? " in" : "")} title={inCart > 0 ? `Đã thêm ${inCart} vào giỏ` : "Xem chi tiết"} aria-hidden="true">
              {inCart > 1 ? inCart : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  {inCart > 0 ? <path d="M5 12.5l4.5 4.5L19 7" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
                </svg>
              )}
            </span>
          </div>
        </div>
      </article>
      {open && <ProductModal product={p} onClose={() => setOpen(false)} />}
    </>
  );
}