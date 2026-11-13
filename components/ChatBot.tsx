"use client";
import { useEffect, useRef, useState } from "react";
import ProductModal from "./ProductModal";
import { BRAND, LogoMark } from "./Logo";
import { respond, type Reply } from "@/lib/chatbot";
import { effectivePrice, onSale, vnd, type Category, type Product } from "@/lib/types";
import "./chatbot.css";

type Msg = { id: number; role: "bot" | "me"; reply: Reply };

// [icon, nhãn ngắn hiển thị, câu gửi đi]
const CHIPS: [string, string, string][] = [
  ["🍔", "Đang đói", "Mình đang đói, muốn ăn no"],
  ["💸", "Ăn rẻ dưới 50k", "Ăn rẻ, dưới 50k"],
  ["👨‍👩‍👧", "Đi nhóm", "Đi nhóm 4 người"],
  ["🔥", "Bán chạy", "Món bán chạy nhất"],
  ["🏷️", "Đang giảm giá", "Có món nào đang giảm giá?"],
  ["🥗", "Ăn nhẹ", "Muốn ăn nhẹ, ít béo"],
  ["🌶️", "Thích cay", "Mình thích ăn cay"],
  ["🥤", "Đồ uống", "Gợi ý đồ uống"],
];

function Thumb({ p }: { p: Product }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="cb-thumb">
      {p.image_url && !bad ? <img src={p.image_url} alt="" loading="lazy" onError={() => setBad(true)} /> : <span aria-hidden>{p.emoji}</span>}
    </span>
  );
}

export default function ChatBot({ products, categories, shipFee, freeShipFrom }: { products: Product[]; categories: Category[]; shipFee: number; freeShipFrom: number }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [pick, setPick] = useState<Product | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, role: "bot", reply: { text: `Chào bạn 👋 Mình là trợ lý chọn món của ${BRAND}. Chưa biết ăn gì thì chọn một gợi ý bên dưới, hoặc nhắn ngân sách, số người, món bạn thích nhé.` } },
  ]);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = msgs.length > 1;

  useEffect(() => {
    const t = setTimeout(() => setTip(true), 2500);
    const h = setTimeout(() => setTip(false), 12000);
    const all = timers.current;
    return () => { clearTimeout(t); clearTimeout(h); all.forEach(clearTimeout); };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing, open]);
  // Lăn chuột dọc trên hàng gợi ý thì cuộn ngang (thanh cuộn đã ẩn cho gọn)
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; }
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [open, started]);

  function send(text: string) {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { id: idRef.current++, role: "me", reply: { text: q } }]);
    setInput("");
    setTyping(true);
    timers.current.push(setTimeout(() => {
      const reply = respond(q, products, categories, { shipFee, freeShipFrom });
      setMsgs((m) => [...m, { id: idRef.current++, role: "bot", reply }]);
      setTyping(false);
    }, 550));
  }

  if (products.length === 0) return null;

  return (
    <>
      {!open && tip && <button className="cb-tip" onClick={() => { setOpen(true); setTip(false); }}>Chưa biết ăn gì? Hỏi mình nhé 🍔</button>}
      <button className={"cb-fab" + (open ? " is-open" : "")} onClick={() => { setOpen((o) => !o); setTip(false); }} aria-label={open ? "Đóng trợ lý chọn món" : "Mở trợ lý chọn món"} aria-expanded={open}>
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" /></svg>
        )}
      </button>

      {open && (
        <section className="cb-panel" role="dialog" aria-label="Trợ lý chọn món" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <header className="cb-head">
            <span className="cb-av" aria-hidden><LogoMark size={24} /></span>
            <div className="cb-ht"><b>Trợ lý chọn món</b><small>Gợi ý theo thực đơn {BRAND}</small></div>
            <button className="cb-x" onClick={() => setOpen(false)} aria-label="Đóng">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div className="cb-body" aria-live="polite">
            {msgs.map((m) => (
              <div key={m.id} className={"cb-row " + m.role}>
                {m.role === "bot" && <span className="cb-ba" aria-hidden><LogoMark size={16} /></span>}
                <div className={"cb-msg " + m.role}>
                  <div className="cb-bub">{m.reply.text}</div>
                  {m.reply.items?.map((p) => (
                    <button key={p.id} className="cb-item" onClick={() => setPick(p)}>
                      <Thumb p={p} />
                      <span className="cb-info">
                        <b>{p.name}</b>
                        <small>{p.description}</small>
                        <span className="cb-price">{onSale(p) && <s>{vnd(p.price)}</s>}<strong>{vnd(effectivePrice(p))}</strong></span>
                      </span>
                      <span className="cb-go" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </button>
                  ))}
                  {m.reply.total ? (
                    <div className="cb-total">
                      <span>Tổng{m.reply.mult && m.reply.mult > 1 ? ` cho ${m.reply.mult} suất` : ""}</span><b>{vnd(m.reply.total)}</b>
                    </div>
                  ) : null}
                  {m.reply.items && m.reply.items.length > 0 && <small className="cb-hint">Bấm vào món để chọn size và thêm vào giỏ</small>}
                </div>
              </div>
            ))}

            {!started && (
              <div className="cb-start">
                {CHIPS.map(([ic, label, text]) => (
                  <button key={text} type="button" className="cb-card" onClick={() => send(text)}>
                    <span className="cb-ic" aria-hidden>{ic}</span>{label}
                  </button>
                ))}
              </div>
            )}

            {typing && (
              <div className="cb-row bot">
                <span className="cb-ba" aria-hidden><LogoMark size={16} /></span>
                <div className="cb-msg bot"><div className="cb-bub cb-dots" aria-label="Đang trả lời"><i /><i /><i /></div></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {started && (
            <div className="cb-chips" ref={chipsRef}>
              {CHIPS.map(([ic, label, text]) => <button key={text} type="button" className="cb-chip" onClick={() => send(text)} disabled={typing}>{ic} {label}</button>)}
            </div>
          )}
          <form className="cb-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <div className="cb-field">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="VD: 2 người, 150k, thích cay…" aria-label="Nhập câu hỏi" maxLength={120} />
              <button type="submit" disabled={!input.trim() || typing} aria-label="Gửi">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
              </button>
            </div>
          </form>
        </section>
      )}
      {pick && <ProductModal product={pick} onClose={() => setPick(null)} />}
    </>
  );
}