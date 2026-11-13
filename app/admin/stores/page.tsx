"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";

type Store = { id: number; name: string; address: string; phone: string | null; hours: string | null; lat: number | null; lng: number | null; active: boolean };
const empty = { name: "", address: "", phone: "", hours: "", lat: "", lng: "" };

export default function StoresAdmin() {
  const [list, setList] = useState<Store[]>([]);
  const [f, setF] = useState<any>(empty);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("stores").select("*").order("id");
    setList((data ?? []) as Store[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setF((x: any) => ({ ...x, [k]: v }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("stores").insert({
      name: f.name.trim(), address: f.address.trim(), phone: f.phone || null, hours: f.hours || null,
      lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null,
    });
    setMsg(error ? error.message : "Đã thêm cửa hàng.");
    if (!error) { setF(empty); load(); }
  }

  return (
    <>
      <h1>Cửa hàng</h1>
      <form onSubmit={add} className="pform">
        <label>Tên chi nhánh<input required value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>Điện thoại<input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="wide">Địa chỉ<input required value={f.address} onChange={(e) => set("address", e.target.value)} /></label>
        <label>Giờ mở cửa<input value={f.hours} onChange={(e) => set("hours", e.target.value)} placeholder="9:00 - 22:00" /></label>
        <span />
        <label>Vĩ độ (lat)<input type="number" step="any" value={f.lat} onChange={(e) => set("lat", e.target.value)} /></label>
        <label>Kinh độ (lng)<input type="number" step="any" value={f.lng} onChange={(e) => set("lng", e.target.value)} /></label>
        <p className="wide">Mẹo: mở Google Maps, bấm chuột phải vào vị trí quán, bấm vào dòng toạ độ để copy. Số đầu là vĩ độ, số sau là kinh độ. Không có toạ độ thì khách vẫn xem được địa chỉ nhưng không sắp xếp theo khoảng cách.</p>
        <div className="wide"><button className="btn small">Thêm cửa hàng</button></div>
      </form>
      {msg && <p role="status">{msg}</p>}
      <h2>Danh sách ({list.length})</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>Tên</th><th>Địa chỉ</th><th>Toạ độ</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td><td>{s.address}</td><td>{s.lat != null ? `${s.lat}, ${s.lng}` : "—"}</td>
              <td><button className="link" onClick={async () => { await supabase.from("stores").update({ active: !s.active }).eq("id", s.id); load(); }}>{s.active ? "Đang hiện" : "Đã ẩn"}</button></td>
              <td><button className="link" onClick={async () => { if (confirm(`Xoá ${s.name}?`)) { await supabase.from("stores").delete().eq("id", s.id); load(); } }}>Xoá</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
