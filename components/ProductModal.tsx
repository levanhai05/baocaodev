"use client";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { supabase } from "@/lib/supabase";
import { effectivePrice, onSale, stars, vnd, type Product } from "@/lib/types";

type Review = { author: string | null; rating: number; comment: string | null; created_at: string };

type Replace = { key: string; qty: number; picks: [number, number][]; note: string };

export default function ProductModal({ product: p, onClose, replace }: { product: Product; onClose: () => void; replace?: Replace }) {
  const { add, change } = useCart();
  const groups = p.options ?? [];
  const [sel, setSel] = useState<Record<number, number[]>>(() => {
    if (replace) {
      const m: Record<number, number[]> = Object.fromEntries(groups.map((_, i) => [i, [] as number[]]));
      replace.picks.forEach(([g, c]) => { (m[g] ??= []).push(c); });
      return m;
    }
    return Object.fromEntries(groups.map((g, i) => [i, g.required && !g.multi ? [0] : []])) as Record<number, number[]>;
  });
  const [qty, setQty] = useState(replace?.qty ?? 1);
  const [note, setNote] = useState(replace?.note ?? "");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [rate, setRate] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);

  const loadReviews = () => supabase.from("reviews").select("author,rating,comment,created_at")
    .eq("product_id", p.id).order("created_at", { ascending: false }).limit(20).then(({ data }) => setReviews((data ?? []) as Review[]));
  useEffect(() => {
    loadReviews();
    supabase.auth.getSession().then(({ data: { session } }) =>
      session && setMe({ id: session.user.id, name: (session.user.email ?? "Khách").split("@")[0] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const picks = groups.flatMap((g, i) => (sel[i] ?? []).map((c) => [i, c] as [number, number]));
  const chosen = picks.map(([g, c]) => groups[g].choices[c]);
  const extra = chosen.reduce((s, c) => s + c.price, 0);
  const unit = effectivePrice(p) + extra;
  const ok = groups.every((g, i) => !g.required || (sel[i]?.length ?? 0) > 0);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  function pick(gi: number, ci: number) {
    setSel((s) => {
      const cur = s[gi] ?? [];
      if (!groups[gi].multi) return { ...s, [gi]: [ci] };
      return { ...s, [gi]: cur.includes(ci) ? cur.filter((x) => x !== ci) : [...cur, ci] };
    });
  }
  function addToCart() {
    if (replace) change(replace.key, -replace.qty);
    add(p, { picks, extra, label: chosen.map((c) => c.name).join(", "), note, qty });
    onClose();
  }
  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    const { data: ex } = await supabase.from("reviews").select("id").eq("product_id", p.id).eq("user_id", me.id).maybeSingle();
    const { error } = ex
      ? await supabase.from("reviews").update({ rating: rate, comment }).eq("id", ex.id)
      : await supabase.from("reviews").insert({ product_id: p.id, user_id: me.id, author: me.name, rating: rate, comment });
    setMsg(error ? "Không gửi được đánh giá." : "Cảm ơn bạn đã đánh giá!");
    if (!error) { setComment(""); loadReviews(); }
  }

  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={p.name}>
        <button className="x modal-x" onClick={onClose} aria-label="Đóng">✕</button>
        <div className="item-art">{p.image_url && !bad ? <img src={p.image_url} alt={p.name} onError={() => setBad(true)} /> : <span>{p.emoji}</span>}</div>
        <div className="modal-body">
          <h2>{p.name}</h2>
          {reviews.length > 0 && <p className="stars">{stars(avg)} <small>{avg.toFixed(1)} ({reviews.length} đánh giá)</small></p>}
          <p>{p.description}</p>
          {groups.map((g, gi) => (
            <fieldset key={gi} className="optgroup">
              <legend>{g.name} <small>{g.required ? "(bắt buộc)" : g.multi ? "(chọn nhiều)" : "(tuỳ chọn)"}</small></legend>
              {g.choices.map((c, ci) => (
                <label key={ci} className="opt">
                  <input type={g.multi ? "checkbox" : "radio"} name={`g${gi}`} checked={(sel[gi] ?? []).includes(ci)} onChange={() => pick(gi, ci)} />
                  <span>{c.name}</span><em>{c.price ? `+${vnd(c.price)}` : "—"}</em>
                </label>
              ))}
            </fieldset>
          ))}
          <label>Ghi chú riêng<input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="VD: ít cay, không hành…" /></label>
          <div className="modal-foot">
            <div className="stepper">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Giảm">−</button><b>{qty}</b>
              <button onClick={() => setQty(qty + 1)} aria-label="Tăng">+</button>
            </div>
            <button className="btn" disabled={!ok} onClick={addToCart}>
              {replace ? "Cập nhật" : "Thêm vào giỏ"} · {vnd(unit * qty)}{onSale(p) && " 🔥"}
            </button>
          </div>

          <h3 style={{ marginTop: "1.6rem" }}>Đánh giá</h3>
          {me ? (
            <form onSubmit={submitReview} className="reviewform">
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Số sao">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{stars(n)} ({n} sao)</option>)}
              </select>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Chia sẻ cảm nhận của bạn…" maxLength={300} />
              <button className="btn small">Gửi</button>
            </form>
          ) : <p><a href="/login"><u>Đăng nhập</u></a> để đánh giá món.</p>}
          {msg && <p role="status">{msg}</p>}
          {reviews.map((r, i) => (
            <div key={i} className="review">
              <b>{r.author ?? "Khách"}</b> <span className="stars">{stars(r.rating)}</span>
              {r.comment && <p>{r.comment}</p>}
            </div>
          ))}
          {reviews.length === 0 && <p>Chưa có đánh giá nào.</p>}
        </div>
      </div>
    </div>
  );
}