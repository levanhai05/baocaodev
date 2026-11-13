"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { STATUS, vnd, type Order } from "@/lib/types";

export default function Customers() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");

  useEffect(() => {
    supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(2000)
      .then(({ data }) => setOrders((data ?? []) as Order[]));
  }, []);

  const list = useMemo(() => {
    const m = new Map<string, { name: string; phone: string; orders: Order[]; spent: number }>();
    orders.forEach((o) => {
      const c = m.get(o.phone) ?? { name: o.customer_name, phone: o.phone, orders: [], spent: 0 };
      c.orders.push(o);
      if (o.status !== "cancelled") c.spent += o.total;
      m.set(o.phone, c);
    });
    return [...m.values()].filter((c) => (c.name + c.phone).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.spent - a.spent);
  }, [orders, q]);

  return (
    <>
      <h1>Khách hàng ({list.length})</h1>
      <input className="search" style={{ marginLeft: 0, marginBottom: "1rem" }} placeholder="Tìm theo tên hoặc SĐT…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tablewrap"><table>
        <thead><tr><th>Khách</th><th>SĐT</th><th>Số đơn</th><th>Đã chi</th><th>Gần nhất</th></tr></thead>
        <tbody>
          {list.map((c) => (
            <Fragment key={c.phone}>
              <tr>
                <td><button className="link" onClick={() => setOpen(open === c.phone ? "" : c.phone)}>{c.name}</button></td>
                <td>{c.phone}</td><td>{c.orders.length}</td><td>{vnd(c.spent)}</td>
                <td>{new Date(c.orders[0].created_at).toLocaleDateString("vi-VN")}</td>
              </tr>
              {open === c.phone && (
                <tr><td colSpan={5}>
                  {c.orders.map((o) => <p key={o.id}>#{o.code} · {new Date(o.created_at).toLocaleString("vi-VN")} · {vnd(o.total)} · {STATUS[o.status]} — {o.order_items.map((i) => `${i.name}×${i.qty}`).join(", ")}</p>)}
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
