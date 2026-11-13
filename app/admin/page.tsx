"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { PAY, PAY_STATUS, STATUS, vnd, type Order } from "@/lib/types";

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select("*, order_items(*)")
      .order("created_at", { ascending: false }).limit(200);
    if (error) setErr(error.message); else setOrders(data as Order[]);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) setErr(error.message); else load();
  }
  async function setPay(id: string, payment_status: string) {
    await supabase.from("orders").update({ payment_status }).eq("id", id); load();
  }
  async function remove(id: string) {
    if (!confirm("Xoá đơn này?")) return;
    await supabase.from("orders").delete().eq("id", id); load();
  }

  const list = orders.filter((o) => filter === "all" || o.status === filter);
  const today = orders.filter((o) => o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10) && o.status !== "cancelled");

  return (
    <>
      <h1>Đơn hàng</h1>
      <div className="stats">
        <div><b>{orders.filter((o) => o.status === "new").length}</b>Đơn mới</div>
        <div><b>{today.length}</b>Đơn hôm nay</div>
        <div><b>{vnd(today.reduce((s, o) => s + o.total, 0))}</b>Doanh thu hôm nay</div>
      </div>
      <div className="tabs">
        {["all", ...Object.keys(STATUS)].map((s) => (
          <button key={s} aria-selected={filter === s} onClick={() => setFilter(s)}>{s === "all" ? "Tất cả" : STATUS[s]}</button>
        ))}
      </div>
      {err && <p className="error">{err}</p>}
      <div className="orders">
        {list.map((o) => (
          <article key={o.id} className="order">
            <header>
              <b>#{o.code}</b>
              <span>{new Date(o.created_at).toLocaleString("vi-VN")}</span>
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </header>
            <p><b>{o.customer_name}</b> · <a href={`tel:${o.phone}`}>{o.phone}</a></p>
            <p>{o.fulfillment === "pickup" ? "🏪 Tự đến lấy" : o.address}{o.scheduled_for && <b> · hẹn {o.scheduled_for}</b>}{o.note && <i> — Ghi chú: {o.note}</i>}</p>
            <ul>{o.order_items.map((i) => <li key={i.id}>{i.name} × {i.qty}{i.options && ` (${i.options})`}{i.note && ` — "${i.note}"`} — {vnd(i.price * i.qty)}</li>)}</ul>
            <footer>
              <span>{o.discount ? `Mã ${o.coupon_code}: −${vnd(o.discount)} · ` : ""}{o.voucher_discount ? `Voucher: −${vnd(o.voucher_discount)} · ` : ""}Ship: {o.shipping_fee ? vnd(o.shipping_fee) : "Miễn phí"} · {PAY[o.payment_method]} · <select value={o.payment_status} onChange={(e) => setPay(o.id, e.target.value)}>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></span>
              <b>{vnd(o.total)}</b>
              <button className="link" onClick={() => remove(o.id)}>Xoá</button>
            </footer>
          </article>
        ))}
        {list.length === 0 && <p>Chưa có đơn nào.</p>}
      </div>
    </>
  );
}