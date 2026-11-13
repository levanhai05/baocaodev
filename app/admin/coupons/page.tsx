"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { vnd } from "@/lib/types";

type Coupon = {
  code: string; description: string | null; percent: number | null; amount: number | null;
  min_order: number; max_discount: number | null; active: boolean; expires_at: string | null;
};
const empty = { code: "", description: "", kind: "percent", value: "", min_order: "0", max_discount: "", expires_at: "", show_home: true };

export default function Coupons() {
  const [list, setList] = useState<Coupon[]>([]);
  const [f, setF] = useState<any>(empty);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Coupon[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(f.value);
    const { error } = await supabase.from("coupons").insert({
      code: f.code.trim().toUpperCase(), description: f.description || null,
      percent: f.kind === "percent" ? v : null, amount: f.kind === "amount" ? v : null,
      min_order: Number(f.min_order) || 0, max_discount: f.max_discount ? Number(f.max_discount) : null,
      expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null, show_home: !!f.show_home,
    });
    setMsg(error ? (error.code === "23505" ? "Mã này đã tồn tại." : error.message) : "Đã thêm mã.");
    if (!error) { setF(empty); load(); }
  }
  async function toggle(c: Coupon) {
    await supabase.from("coupons").update({ active: !c.active }).eq("code", c.code); load();
  }
  async function del(code: string) {
    if (!confirm(`Xoá mã ${code}?`)) return;
    await supabase.from("coupons").delete().eq("code", code); load();
  }

  return (
    <>
      <h1>Mã giảm giá</h1>
      <form onSubmit={save} className="pform">
        <label>Mã (viết liền, không dấu)<input required value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="VD: FREESHIP20" /></label>
        <label>Loại giảm
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="percent">Giảm theo %</option>
            <option value="amount">Giảm số tiền cố định (VNĐ)</option>
          </select>
        </label>
        <label>{f.kind === "percent" ? "Số % giảm (1–100)" : "Số tiền giảm (VNĐ)"}
          <input required type="number" min={1} max={f.kind === "percent" ? 100 : undefined} value={f.value} onChange={(e) => set("value", e.target.value)} />
        </label>
        <label>Đơn tối thiểu (VNĐ)<input type="number" min={0} value={f.min_order} onChange={(e) => set("min_order", e.target.value)} /></label>
        <label>Giảm tối đa (VNĐ, để trống nếu không giới hạn)<input type="number" min={0} value={f.max_discount} onChange={(e) => set("max_discount", e.target.value)} /></label>
        <label>Hết hạn (để trống nếu không có)<input type="datetime-local" value={f.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></label>
        <label className="wide">Mô tả hiển thị cho khách<input value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="wide" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={!!f.show_home} onChange={(e) => set("show_home", e.target.checked)} />Hiện mã chạy trên trang chủ (bỏ tick nếu chỉ gửi riêng cho khách)</label>
        <div className="wide"><button className="btn small">Thêm mã</button></div>
      </form>
      {msg && <p role="status">{msg}</p>}

      <h2>Danh sách mã ({list.length})</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Mã</th><th>Giảm</th><th>Đơn tối thiểu</th><th>Hết hạn</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.code}>
                <td><b>{c.code}</b></td>
                <td>{c.percent ? `${c.percent}%${c.max_discount ? ` (tối đa ${vnd(c.max_discount)})` : ""}` : vnd(c.amount ?? 0)}</td>
                <td>{vnd(c.min_order)}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleString("vi-VN") : "—"}</td>
                <td><button className="link" onClick={() => toggle(c)}>{c.active ? "Đang bật" : "Đã tắt"}</button></td>
                <td><button className="link" onClick={() => del(c.code)}>Xoá</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}