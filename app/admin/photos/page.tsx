"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Thu nhỏ ảnh về tối đa 1000px để web tải nhanh
async function shrink(f: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.85));
  } catch { return f; }
}

export default function Photos() {
  const [prods, setProds] = useState<Product[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").order("id");
    setProds((data ?? []) as Product[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function put(p: Product, file: File): Promise<string | null> {
    const blob = await shrink(file);
    const path = `${p.id}-${Date.now()}.jpg`;
    const up = await supabase.storage.from("products").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
    if (up.error) return up.error.message;
    const url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("products").update({ image_url: url }).eq("id", p.id);
    return error ? error.message : null;
  }

  async function one(p: Product, f?: File) {
    if (!f) return;
    setBusy(true); setMsg(`Đang tải ảnh cho "${p.name}"…`);
    const err = await put(p, f);
    setBusy(false); setMsg(err ? `Lỗi: ${err}` : `Đã cập nhật ảnh "${p.name}".`);
    load();
  }

  async function bulk(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const done: string[] = [], miss: string[] = [];
    for (const f of Array.from(files)) {
      const base = slug(f.name.replace(/\.[^.]+$/, ""));
      const p = prods.find((x) => slug(x.name) === base) ?? prods.find((x) => base.length >= 4 && (slug(x.name).includes(base) || base.includes(slug(x.name))));
      if (!p) { miss.push(f.name); continue; }
      setMsg(`Đang tải ${f.name} → ${p.name}…`);
      const err = await put(p, f);
      err ? miss.push(`${f.name} (${err})`) : done.push(p.name);
    }
    setBusy(false); load();
    setMsg(`Đã cập nhật ${done.length} món.${miss.length ? ` Không ghép được: ${miss.join(", ")}` : ""}`);
  }

  return (
    <>
      <h1>Ảnh món</h1>
      <p>Cách nhanh nhất: đặt tên file ảnh trùng tên món (VD: <b>double-beef-burger.jpg</b>, <b>khoai-tay-chien.png</b>), rồi chọn nhiều ảnh một lần ở ô dưới. Web tự ghép đúng món và tự thu nhỏ ảnh.</p>
      <label style={{ display: "block", margin: "1rem 0" }}>
        Chọn nhiều ảnh cùng lúc
        <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { bulk(e.target.files); e.target.value = ""; }} />
      </label>
      {msg && <p role="status"><b>{msg}</b></p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "1rem", marginTop: "1rem" }}>
        {prods.map((p) => (
          <div key={p.id} className="result" style={{ padding: ".8rem" }}>
            <div style={{ height: 130, borderRadius: 10, overflow: "hidden", background: "#FFC21A", display: "grid", placeItems: "center", fontSize: "3rem" }}>
              {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.emoji}
            </div>
            <b>{p.name}</b>
            <small>Tên file gợi ý: {slug(p.name)}.jpg</small>
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => { one(p, e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        ))}
      </div>
    </>
  );
}
