"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { PAY, PAY_STATUS, vnd, type Order } from "@/lib/types";

export default function Payments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [method, setMethod] = useState("all");
  const [pstat, setPstat] = useState("all");

  const load = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").neq("status", "cancelled").order("created_at", { ascending: false }).limit(500);
    setOrders((data ?? []) as Order[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = orders.filter((o) => (method === "all" || o.payment_method === method) && (pstat === "all" || o.payment_status === pstat));
  const sum = (st: string) => orders.filter((o) => o.payment_status === st).reduce((a, o) => a + o.total, 0);

  return (
    <>
      <h1>Thanh toán</h1>
      <div className="stats">
        <div><b>{vnd(sum("paid"))}</b>Đã thu</div>
        <div><b>{vnd(sum("unpaid"))}</b>Chưa thu (gồm tiền mặt chờ giao)</div>
        <div><b>{orders.filter((o) => o.payment_status === "failed").length}</b>Giao dịch lỗi</div>
      </div>
      <div className="tabs">
        {["all", ...Object.keys(PAY)].map((m) => <button key={m} aria-selected={method === m} onClick={() => setMethod(m)}>{m === "all" ? "Mọi hình thức" : PAY[m]}</button>)}
        <select className="sortsel" value={pstat} onChange={(e) => setPstat(e.target.value)} aria-label="Lọc theo trạng thái">
          <option value="all">Mọi trạng thái</option>
          {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="tablewrap"><table>
        <thead><tr><th>Mã đơn</th><th>Thời gian</th><th>Khách</th><th>Hình thức</th><th>Số tiền</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id}>
              <td>#{o.code}</td><td>{new Date(o.created_at).toLocaleString("vi-VN")}</td><td>{o.customer_name} · {o.phone}</td>
              <td>{PAY[o.payment_method]}</td><td>{vnd(o.total)}</td>
              <td>
                <select value={o.payment_status} onChange={async (e) => { await supabase.from("orders").update({ payment_status: e.target.value }).eq("id", o.id); load(); }}>
                  {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
