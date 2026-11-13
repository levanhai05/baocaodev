"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";

type Staff = { user_id: string; name: string | null; email: string; created_at: string };

async function api(method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch("/api/admin/staff", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default function StaffAdmin() {
  const [list, setList] = useState<Staff[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api("GET");
    if (r.ok) setList(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg("");
    const r = await api("POST", { name: f.get("name"), email: f.get("email"), password: f.get("password") });
    const d = await r.json();
    setBusy(false);
    setMsg(r.ok ? "Đã tạo tài khoản nhân viên." : d.error);
    if (r.ok) { form.reset(); load(); }
  }
  async function del(s: Staff) {
    if (!confirm(`Xoá tài khoản ${s.email}?`)) return;
    await api("DELETE", { user_id: s.user_id }); load();
  }

  return (
    <>
      <h1>Nhân viên</h1>
      <p>Nhân viên đăng nhập tại <b>/admin/login</b>, chỉ thấy bảng xử lý đơn hàng (không vào được quản trị).</p>
      <h2>Thêm nhân viên</h2>
      <form onSubmit={add} className="pform">
        <label>Họ tên<input name="name" /></label>
        <label>Email đăng nhập<input name="email" type="email" required /></label>
        <label>Mật khẩu (tối thiểu 6 ký tự)<input name="password" type="text" required minLength={6} /></label>
        <div className="wide"><button className="btn small" disabled={busy}>{busy ? "Đang tạo…" : "Tạo tài khoản"}</button></div>
      </form>
      {msg && <p role="status">{msg}</p>}
      <h2>Danh sách ({list.length})</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Ngày tạo</th><th /></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.user_id}>
                <td>{s.name ?? "—"}</td><td>{s.email}</td>
                <td>{new Date(s.created_at).toLocaleDateString("vi-VN")}</td>
                <td><button className="link" onClick={() => del(s)}>Xoá</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
