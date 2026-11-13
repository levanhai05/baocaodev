"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { stars } from "@/lib/types";

type R = { id: number; author: string | null; rating: number; comment: string | null; created_at: string; products: { name: string } | null };

export default function Reviews() {
  const [list, setList] = useState<R[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("reviews").select("*, products(name)").order("created_at", { ascending: false }).limit(200);
    setList((data ?? []) as unknown as R[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <h1>Đánh giá ({list.length})</h1>
      <div className="tablewrap"><table>
        <thead><tr><th>Món</th><th>Khách</th><th>Sao</th><th>Nhận xét</th><th>Ngày</th><th /></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td>{r.products?.name ?? "—"}</td><td>{r.author}</td><td className="stars">{stars(r.rating)}</td>
              <td>{r.comment}</td><td>{new Date(r.created_at).toLocaleDateString("vi-VN")}</td>
              <td><button className="link" onClick={async () => { if (confirm("Xoá đánh giá này?")) { await supabase.from("reviews").delete().eq("id", r.id); load(); } }}>Xoá</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
