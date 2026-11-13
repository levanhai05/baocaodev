"use client";
import { useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

export default function SettingsPage() {
  const [f, setF] = useState<Settings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState("");
  useEffect(() => { supabase.from("settings").select("*").maybeSingle().then(({ data }) => data && setF({ ...DEFAULT_SETTINGS, ...data })); }, []);
  const set = (k: keyof Settings, v: any) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("settings").update({ ...f, ship_fee: Number(f.ship_fee), free_ship_from: Number(f.free_ship_from) }).eq("id", 1);
    setMsg(error ? "Không lưu được: " + error.message : "Đã lưu. Trang chủ cập nhật sau tối đa 1 phút.");
  }

  return (
    <>
      <h1>Cài đặt cửa hàng</h1>
      <form onSubmit={save} className="pform">
        <label>Tên cửa hàng<input value={f.shop_name} onChange={(e) => set("shop_name", e.target.value)} /></label>
        <label>Hotline<input value={f.hotline} onChange={(e) => set("hotline", e.target.value)} /></label>
        <label className="wide">Địa chỉ cửa hàng (hiện ở chân trang và cho khách tự đến lấy)<input value={f.address} onChange={(e) => set("address", e.target.value)} /></label>
        <label>Phí giao hàng (VNĐ)<input type="number" min={0} value={f.ship_fee} onChange={(e) => set("ship_fee", e.target.value)} /></label>
        <label>Miễn phí giao từ (VNĐ)<input type="number" min={0} value={f.free_ship_from} onChange={(e) => set("free_ship_from", e.target.value)} /></label>
        <label className="wide">Dòng thông báo khuyến mãi trên cùng trang chủ (để trống để ẩn)<input value={f.banner_text ?? ""} onChange={(e) => set("banner_text", e.target.value)} /></label>
        <label className="check wide"><input type="checkbox" checked={f.is_open} onChange={(e) => set("is_open", e.target.checked)} /> Cửa hàng đang mở cửa nhận đơn (bỏ tick để tạm ngưng nhận đơn)</label>
        <div className="wide"><button className="btn small">Lưu cài đặt</button></div>
      </form>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
