"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { PAY_STATUS, STATUS, vnd, type Order } from "@/lib/types";

const dkey = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    supabase.from("orders").select("*, order_items(*)").gte("created_at", since).order("created_at").limit(2000)
      .then(({ data }) => setOrders((data ?? []) as Order[]));
  }, [days]);

  const s = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((a, o) => a + o.total, 0);
    const byDay = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) byDay.set(dkey(new Date(Date.now() - i * 864e5)), 0);
    valid.forEach((o) => { const k = dkey(new Date(o.created_at)); if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + o.total); });
    const top = new Map<string, { qty: number; rev: number }>();
    valid.forEach((o) => o.order_items.forEach((i) => {
      const t = top.get(i.name) ?? { qty: 0, rev: 0 }; t.qty += i.qty; t.rev += i.qty * i.price; top.set(i.name, t);
    }));
    return {
      revenue, count: valid.length, avg: valid.length ? Math.round(revenue / valid.length) : 0,
      unpaid: valid.filter((o) => o.payment_status !== "paid").length,
      hasCost: valid.some((o) => o.order_items.some((i) => (i.cost ?? 0) > 0)),
      profit: valid.reduce((a, o) => a + o.order_items.reduce((x, i) => x + i.qty * (i.price - (i.cost ?? 0)), 0) - (o.discount ?? 0) - (o.points_used ?? 0) * 1000 - (o.voucher_discount ?? 0), 0),
      bars: [...byDay.entries()], max: Math.max(1, ...byDay.values()),
      top: [...top.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 6),
      status: Object.keys(STATUS).map((k) => [k, orders.filter((o) => o.status === k).length] as const),
    };
  }, [orders, days]);

  function exportCsv() {
    const rows = [["Mã", "Thời gian", "Khách", "SĐT", "Tổng", "Trạng thái", "Thanh toán"],
      ...orders.map((o) => [o.code, new Date(o.created_at).toLocaleString("vi-VN"), o.customer_name, o.phone, o.total, STATUS[o.status], PAY_STATUS[o.payment_status]])];
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bao-cao-${days}-ngay.csv`; a.click();
  }

  return (
    <>
      <h1>Tổng quan</h1>
      <div className="tabs">
        {[7, 30, 90].map((d) => <button key={d} aria-selected={days === d} onClick={() => setDays(d)}>{d} ngày qua</button>)}
        <button className="btn small ink" style={{ marginLeft: "auto" }} onClick={exportCsv}>Xuất báo cáo CSV</button>
      </div>
      <div className="stats">
        <div><b>{vnd(s.revenue)}</b>Doanh thu</div>
        <div><b>{s.count}</b>Đơn hàng (không tính đơn huỷ)</div>
        <div><b>{vnd(s.avg)}</b>Giá trị đơn trung bình</div>
        <div><b>{s.unpaid}</b>Đơn chưa thanh toán</div>
        <div><b>{s.hasCost ? vnd(s.profit) : "—"}</b>Lợi nhuận gộp ước tính{!s.hasCost && " (nhập giá vốn ở mục Món)"}</div>
      </div>
      <h2>Doanh thu theo ngày</h2>
      <div className="chart" role="img" aria-label="Biểu đồ doanh thu theo ngày">
        {s.bars.map(([k, v]) => (
          <div key={k} className="bar" title={`${k}: ${vnd(v)}`}>
            <i style={{ height: `${Math.max(2, (v / s.max) * 100)}%` }} /><span>{days <= 30 ? k : ""}</span>
          </div>
        ))}
      </div>
      <h2>Món bán chạy</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>Món</th><th>Số lượng</th><th>Doanh thu</th></tr></thead>
        <tbody>{s.top.map(([n, t]) => <tr key={n}><td>{n}</td><td>{t.qty}</td><td>{vnd(t.rev)}</td></tr>)}</tbody>
      </table></div>
      <h2>Đơn theo trạng thái</h2>
      <div className="chips">{s.status.map(([k, n]) => <span key={k}>{STATUS[k]}: <b>{n}</b></span>)}</div>
    </>
  );
}