
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";

type Role = "kitchen" | "shipper";

type Store = {
  id: number;
  name: string;
};

type Staff = {
  user_id: string;
  name: string | null;
  email: string;
  role: Role;
  store_id: number;
  store_name: string;
  active: boolean;
  created_at: string;
};

async function api(method: string, body?: object) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch("/api/admin/staff", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const roleName = (role: Role) =>
  role === "kitchen" ? "Nhân viên bếp" : "Shipper";

export default function StaffAdmin() {
  const [list, setList] = useState<Staff[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("GET");
      const d = await r.json();

      if (!r.ok) {
        setMsg(d.error || "Không tải được danh sách nhân viên.");
        return;
      }

      setList(d.staff ?? []);
      setStores(d.stores ?? []);
    } catch {
      setMsg("Không kết nối được máy chủ.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateStaff(userId: string, changes: Partial<Staff>) {
    setList((prev) =>
      prev.map((s) =>
        s.user_id === userId ? { ...s, ...changes } : s
      )
    );
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const f = new FormData(form);

    setBusy(true);
    setMsg("");

    try {
      const r = await api("POST", {
        name: f.get("name"),
        email: f.get("email"),
        role: f.get("role"),
        store_id: Number(f.get("store_id")),
      });

      const d = await r.json();

      if (!r.ok) {
        setMsg(d.error || "Không tạo được nhân viên.");
        return;
      }

      setMsg("Đã tạo tài khoản nhân viên thành công.");
      form.reset();
      await load();
    } catch {
      setMsg("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  async function saveStaff(s: Staff) {
    setSavingId(s.user_id);
    setMsg("");

    try {
      const r = await api("PUT", {
        user_id: s.user_id,
        name: s.name ?? "",
        role: s.role,
        store_id: s.store_id,
        active: s.active,
      });

      const d = await r.json();

      if (!r.ok) {
        setMsg(d.error || "Không cập nhật được nhân viên.");
      } else {
        setMsg(`Đã cập nhật ${s.name || s.email}.`);
        await load();
      }
    } catch {
      setMsg("Không kết nối được máy chủ.");
    } finally {
      setSavingId("");
    }
  }

  async function del(s: Staff) {
    if (!confirm(`Xóa tài khoản ${s.email}? Nhân viên sẽ không thể đăng nhập nữa.`)) {
      return;
    }

    setMsg("");

    try {
      const r = await api("DELETE", { user_id: s.user_id });
      const d = await r.json();

      if (!r.ok) {
        setMsg(d.error || "Không xóa được nhân viên.");
        return;
      }

      setMsg("Đã xóa tài khoản nhân viên.");
      await load();
    } catch {
      setMsg("Không kết nối được máy chủ.");
    }
  }

  const activeCount = list.filter((s) => s.active).length;
  const kitchenCount = list.filter((s) => s.role === "kitchen").length;
  const shipperCount = list.filter((s) => s.role === "shipper").length;

  return (
    <div className="staff-page">
      <h1>Quản lý nhân viên</h1>
      <p>
        Tạo tài khoản, phân vai trò và chỉ định chi nhánh làm việc cho từng nhân viên.
      </p>

      <div className="staff-stats">
        <div className="staff-stat">
          <span>Tổng nhân viên</span>
          <strong>{list.length}</strong>
        </div>
        <div className="staff-stat">
          <span>Đang hoạt động</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="staff-stat">
          <span>Nhân viên bếp</span>
          <strong>{kitchenCount}</strong>
        </div>
        <div className="staff-stat">
          <span>Shipper</span>
          <strong>{shipperCount}</strong>
        </div>
      </div>

      <h2>Thêm nhân viên</h2>

      <form onSubmit={add} className="pform staff-form">
        <label>
          Họ và tên
          <input name="name" placeholder="Nhập họ tên nhân viên" required />
        </label>

        <label>
          Email đăng nhập
          <input
            name="email"
            type="email"
            placeholder="example@gmail.com"
            required
          />
        </label>

        <label>
          Vai trò
          <select name="role" defaultValue="kitchen" required>
            <option value="kitchen">Nhân viên bếp</option>
            <option value="shipper">Shipper</option>
          </select>
        </label>

        <label>
          Chi nhánh làm việc
          <select name="store_id" defaultValue={stores[0]?.id ?? ""} required>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>

        <div className="wide">
          <button
            className="btn small"
            disabled={busy || stores.length === 0}
          >
            {busy ? "Đang tạo..." : "＋ Tạo tài khoản nhân viên"}
          </button>

          {stores.length === 0 && (
            <p>Chưa có chi nhánh hoạt động. Hãy tạo hoặc kích hoạt chi nhánh trước.</p>
          )}
        </div>
      </form>

      {msg && (
        <p role="status" className="staff-message">
          {msg}
        </p>
      )}

      <h2>Danh sách nhân viên ({list.length})</h2>

      <div className="tablewrap">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Chi nhánh</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {list.map((s) => (
              <tr key={s.user_id}>
                <td>
                  <input
                    value={s.name ?? ""}
                    aria-label="Họ tên nhân viên"
                    onChange={(e) =>
                      updateStaff(s.user_id, { name: e.target.value })
                    }
                    style={{ minWidth: 120 }}
                  />
                </td>

                <td>{s.email}</td>

                <td>
                  <select
                    value={s.role}
                    onChange={(e) =>
                      updateStaff(s.user_id, {
                        role: e.target.value as Role,
                      })
                    }
                  >
                    <option value="kitchen">Nhân viên bếp</option>
                    <option value="shipper">Shipper</option>
                  </select>
                </td>

                <td>
                  <select
                    value={s.store_id}
                    onChange={(e) =>
                      updateStaff(s.user_id, {
                        store_id: Number(e.target.value),
                      })
                    }
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <select
                    value={s.active ? "true" : "false"}
                    onChange={(e) =>
                      updateStaff(s.user_id, {
                        active: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">Hoạt động</option>
                    <option value="false">Ngừng hoạt động</option>
                  </select>
                </td>

                <td>
                  {new Date(s.created_at).toLocaleDateString("vi-VN")}
                </td>

                <td>
                  <div className="staff-actions">
                    <button
                      className="btn small"
                      disabled={savingId === s.user_id}
                      onClick={() => saveStaff(s)}
                    >
                      {savingId === s.user_id ? "Đang lưu..." : "Lưu"}
                    </button>

                    <button className="link" onClick={() => del(s)}>
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {list.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                  Chưa có nhân viên. Hãy tạo tài khoản đầu tiên ở phía trên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
