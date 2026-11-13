"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Addr = { id: number; label: string; address: string; is_default: boolean };

export default function AddressBook({ uid }: { uid: string }) {
  const [list, setList] = useState<Addr[]>([]);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("id");
    setList((data ?? []) as Addr[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (list.length >= 10) { setMsg("Tối đa 10 địa chỉ. Hãy xoá bớt địa chỉ cũ."); return; }
    const { error } = await supabase.from("addresses").insert({
      user_id: uid, label: label.trim() || "Địa chỉ", address: address.trim(), is_default: list.length === 0,
    });
    setMsg(error ? "Không lưu được địa chỉ." : "");
    if (!error) { setLabel(""); setAddress(""); load(); }
  }
  async function makeDefault(id: number) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", uid);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    load();
  }
  async function del(id: number) {
    await supabase.from("addresses").delete().eq("id", id);
    load();
  }

  return (
    <section className="acc-card">
      <div className="acc-sec-h">
        <span className="acc-ic">⌂</span>
        <div><h2>Sổ địa chỉ</h2><p>Lưu tối đa 10 địa chỉ để chọn nhanh khi đặt hàng.</p></div>
        {list.length > 0 && <span className="acc-count">{list.length}</span>}
      </div>

      {list.length === 0 ? (
        <div className="acc-empty"><span>📍</span>Chưa có địa chỉ nào. Thêm địa chỉ để chọn nhanh khi đặt hàng.</div>
      ) : (
        <div className="addr-list">
          {list.map((a) => (
            <div key={a.id} className={"addr" + (a.is_default ? " def" : "")}>
              <div className="addr-h"><b>{a.label}</b>{a.is_default && <span className="addr-badge">Mặc định</span>}</div>
              <p>{a.address}</p>
              <div className="addr-act">
                {!a.is_default && <button className="link" onClick={() => makeDefault(a.id)}>Đặt làm mặc định</button>}
                <button className="link danger" onClick={() => del(a.id)}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="acc-form addr-add">
        <label>Tên gọi<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} placeholder="Nhà, Công ty…" /></label>
        <label>Địa chỉ đầy đủ<input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện" /></label>
        <button className="btn">+ Thêm địa chỉ</button>
        {msg && <p className="acc-msg err" role="alert">{msg}</p>}
      </form>
    </section>
  );
}