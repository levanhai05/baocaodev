"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { parseOptions, stringifyOptions, vnd, type Category, type Product } from "@/lib/types";

const empty = { name: "", description: "", price: "", category_id: "", emoji: "🍔", image_url: "", is_hot: false, is_available: true, options_text: "", sale_price: "", sale_until: "", cost: "" };

export default function ProductsAdmin() {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [pct, setPct] = useState(""); // % giảm giá, chỉ để nhập nhanh (không lưu DB)
  const [editing, setEditing] = useState<number | null>(null);
  const [newCat, setNewCat] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from("categories").select("*").order("sort"),
      supabase.from("products").select("*").order("id"),
    ]);
    setCats((c.data ?? []) as Category[]); setProds((p.data ?? []) as Product[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Giảm giá % <-> giá khuyến mãi tự đồng bộ
  const calcSale = (price: string, p: string) => {
    const n = Number(p), base = Number(price);
    return p !== "" && base > 0 && n > 0 && n < 100 ? String(Math.round(base * (1 - n / 100))) : "";
  };
  const calcPct = (price: string, sale: string) => {
    const base = Number(price), s = Number(sale);
    return sale !== "" && base > 0 && s >= 0 && s < base ? String(Math.round((1 - s / base) * 1000) / 10) : "";
  };
  const onPrice = (v: string) => setForm((f: any) => ({ ...f, price: v, ...(pct ? { sale_price: calcSale(v, pct) } : {}) }));
  const onPct = (v: string) => { setPct(v); setForm((f: any) => ({ ...f, sale_price: calcSale(f.price, v) })); };
  const onSale = (v: string) => { set("sale_price", v); setPct(calcPct(form.price, v)); };

  async function upload(file: File) {
    setBusy(true);
    const path = `${Date.now()}-${file.name.replace(/[^\w.]/g, "_")}`;
    const { error } = await supabase.storage.from("products").upload(path, file);
    setBusy(false);
    if (error) { setMsg("Upload ảnh lỗi: " + error.message); return; }
    set("image_url", supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = {
      name: form.name, description: form.description || null, price: Number(form.price),
      category_id: form.category_id ? Number(form.category_id) : null, emoji: form.emoji || "🍔",
      image_url: form.image_url || null, is_hot: form.is_hot, is_available: form.is_available,
      options: parseOptions(form.options_text), cost: form.cost ? Number(form.cost) : null, sale_price: form.sale_price ? Number(form.sale_price) : null,
      sale_until: form.sale_until ? new Date(form.sale_until).toISOString() : null,
    };
    const { error } = editing
      ? await supabase.from("products").update(row).eq("id", editing)
      : await supabase.from("products").insert(row);
    setMsg(error ? error.message : editing ? "Đã lưu thay đổi." : "Đã thêm món.");
    if (!error) { setForm(empty); setPct(""); setEditing(null); load(); }
  }

  function edit(p: Product) {
    setEditing(p.id);
    setForm({ ...p, price: String(p.price), category_id: p.category_id ?? "", description: p.description ?? "", image_url: p.image_url ?? "",
      options_text: stringifyOptions(p.options), sale_price: p.sale_price ?? "", sale_until: p.sale_until ? p.sale_until.slice(0, 16) : "", cost: p.cost ?? "" });
    setPct(calcPct(String(p.price), p.sale_price ? String(p.sale_price) : ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function del(id: number) {
    if (!confirm("Xoá món này?")) return;
    await supabase.from("products").delete().eq("id", id); load();
  }
  async function toggle(p: Product) {
    await supabase.from("products").update({ is_available: !p.is_available }).eq("id", p.id); load();
  }
  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    await supabase.from("categories").insert({ name: newCat.trim(), sort: cats.length + 1 });
    setNewCat(""); load();
  }
  async function delCat(id: number) {
    if (!confirm("Xoá danh mục? Các món trong đó sẽ không còn danh mục.")) return;
    await supabase.from("categories").delete().eq("id", id); load();
  }

  return (
    <>
      <h1>Món & danh mục</h1>

      <h2>Danh mục</h2>
      <div className="chips">
        {cats.map((c) => <span key={c.id}>{c.name} <button onClick={() => delCat(c.id)} aria-label={`Xoá ${c.name}`}>✕</button></span>)}
      </div>
      <form onSubmit={addCat} className="inline">
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Tên danh mục mới" />
        <button className="btn small">Thêm</button>
      </form>

      <h2>{editing ? "Sửa món" : "Thêm món"}</h2>
      <form onSubmit={save} className="pform">
        <label>Tên món<input required value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>Giá (VNĐ)<input required type="number" min={0} value={form.price} onChange={(e) => onPrice(e.target.value)} /></label>
        <label>Danh mục
          <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">— Không có —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Emoji (khi chưa có ảnh)<input value={form.emoji} onChange={(e) => set("emoji", e.target.value)} /></label>
        <label className="wide">Mô tả<input value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="wide">Tuỳ chọn món (mỗi dòng 1 nhóm). Ví dụ: Size*: Vừa=0 | Lớn=10000 — dấu * bắt buộc chọn, dấu + chọn nhiều
          <textarea rows={3} value={form.options_text} onChange={(e) => set("options_text", e.target.value)} placeholder={"Size*: Vừa=0 | Lớn=10000\nThêm+: Phô mai=8000 | Bacon=15000"} />
        </label>
        <label>Giá khuyến mãi (VNĐ, để trống nếu không)<input type="number" min={0} value={form.sale_price} onChange={(e) => onSale(e.target.value)} /></label>
        <label>Khuyến mãi đến (để trống nếu không giới hạn)<input type="datetime-local" value={form.sale_until} onChange={(e) => set("sale_until", e.target.value)} /></label>
        <label>Giá vốn (VNĐ, để tính lợi nhuận)<input type="number" min={0} value={form.cost} onChange={(e) => set("cost", e.target.value)} /></label>
        <label>Giảm giá (%) — tự điền giá khuyến mãi<input type="number" min={0} max={99} step="any" placeholder="VD: 20" value={pct} onChange={(e) => onPct(e.target.value)} /></label>
        <label className="wide">Ảnh món
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {form.image_url && <img src={form.image_url} alt="" className="thumb" />}
        <label className="check"><input type="checkbox" checked={form.is_hot} onChange={(e) => set("is_hot", e.target.checked)} /> Bán chạy</label>
        <label className="check"><input type="checkbox" checked={form.is_available} onChange={(e) => set("is_available", e.target.checked)} /> Đang bán</label>
        <div className="wide">
          <button className="btn small" disabled={busy}>{busy ? "Đang tải ảnh…" : editing ? "Lưu thay đổi" : "Thêm món"}</button>{" "}
          {editing && <button type="button" className="link" onClick={() => { setEditing(null); setForm(empty); setPct(""); }}>Huỷ sửa</button>}
        </div>
      </form>
      {msg && <p role="status">{msg}</p>}

      <h2>Danh sách món ({prods.length})</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Món</th><th>Danh mục</th><th>Giá</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {prods.map((p) => (
              <tr key={p.id}>
                <td>{p.image_url ? <img src={p.image_url} alt="" className="mini" /> : p.emoji} {p.name}</td>
                <td>{cats.find((c) => c.id === p.category_id)?.name ?? "—"}</td>
                <td>{vnd(p.price)}</td>
                <td><button className="link" onClick={() => toggle(p)}>{p.is_available ? "Đang bán" : "Hết hàng"}</button></td>
                <td><button className="link" onClick={() => edit(p)}>Sửa</button> · <button className="link" onClick={() => del(p.id)}>Xoá</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}