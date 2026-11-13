"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { PAY, PAY_STATUS, STATUS, vnd, type Order } from "@/lib/types";

const COLS = ["new", "confirmed", "preparing", "delivering"];
const NEXT: Record<string, { to: string; label: string }> = {
  new: { to: "confirmed", label: "Xác nhận đơn" },
  confirmed: { to: "preparing", label: "Bắt đầu chuẩn bị" },
  preparing: { to: "delivering", label: "Xong · giao / bàn giao" },
  delivering: { to: "done", label: "Đã giao thành công" },
};

function beep() {
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    const c = new C(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.25;
    o.start(); o.stop(c.currentTime + 0.35);
  } catch {}
}
function notify(o: { code?: string; customer_name?: string; total?: number }) {
  try {
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(`Đơn mới #${o.code ?? ""}`, { body: `${o.customer_name ?? ""} · ${vnd(o.total ?? 0)}` });
  } catch {}
}
const ago = (d: string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : `${Math.floor(m / 60)} giờ trước`;
};

export default function Board() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"live" | "history">("live");
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  soundRef.current = sound;

  const load = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(200);
    setOrders((data ?? []) as Order[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("staff-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        if (p.eventType === "INSERT") { if (soundRef.current) { beep(); notify(p.new as any); } setTimeout(load, 1500); } // chờ món trong đơn được lưu
        else load();
      }).subscribe();
    const t = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [load]);

  async function move(id: string, status: string) {
    await supabase.from("orders").update({ status }).eq("id", id); load();
  }

  const Card = ({ o }: { o: Order }) => (
    <article className={`tcard ${o.status === "new" ? "fresh" : ""}`}>
      <header style={{ display: "flex", justifyContent: "space-between" }}><b>#{o.code}</b><span>{ago(o.created_at)}</span></header>
      <p><b>{o.customer_name}</b> · <a href={`tel:${o.phone}`}>{o.phone}</a></p>
      <p>{o.fulfillment === "pickup" ? "🏪 TỰ ĐẾN LẤY" : o.address}{o.scheduled_for && <b> · hẹn {o.scheduled_for}</b>}</p>
      {o.note && <p><i>Ghi chú: {o.note}</i></p>}
      <ul>{o.order_items.map((i) => <li key={i.id}>{i.name} × <b>{i.qty}</b>{i.options && <> — {i.options}</>}{i.note && <i> ("{i.note}")</i>}</li>)}</ul>
      <p><b>{vnd(o.total)}</b> · {PAY[o.payment_method]} · {PAY_STATUS[o.payment_status]}</p>
      {NEXT[o.status] && (
        <div className="acts">
          <button className="btn small" onClick={() => move(o.id, NEXT[o.status].to)}>{NEXT[o.status].label}</button>
          <button className="link" onClick={() => confirm(`Huỷ đơn #${o.code}?`) && move(o.id, "cancelled")}>Huỷ đơn</button>
        </div>
      )}
    </article>
  );

  const live = orders.filter((o) => COLS.includes(o.status));
  const history = orders.filter((o) => !COLS.includes(o.status));
  return (
    <>
      <div className="tabs">
        <button aria-selected={tab === "live"} onClick={() => setTab("live")}>Đơn đang xử lý ({live.length})</button>
        <button aria-selected={tab === "history"} onClick={() => setTab("history")}>Lịch sử ({history.length})</button>
        <button className="btn small ink" style={{ marginLeft: "auto" }} onClick={() => { setSound(!sound); if (!sound) { beep(); if ("Notification" in window) Notification.requestPermission(); } }}>
          {sound ? "🔔 Âm báo + thông báo: BẬT" : "🔕 Bật âm báo & thông báo đơn mới"}
        </button>
      </div>
      {tab === "live" ? (
        <div className="board">
          {COLS.map((c) => {
            const list = live.filter((o) => o.status === c).reverse();
            return (
              <section key={c} className="col">
                <h3>{STATUS[c]} <span>{list.length}</span></h3>
                {list.map((o) => <Card key={o.id} o={o} />)}
                {list.length === 0 && <p style={{ color: "#8a7f72" }}>Không có đơn.</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="board" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))" }}>
          {history.map((o) => <div key={o.id}><Card o={o} /><p style={{ margin: ".3rem" }}>{STATUS[o.status]}</p></div>)}
          {history.length === 0 && <p>Chưa có đơn nào hoàn thành.</p>}
        </div>
      )}
    </>
  );
}
