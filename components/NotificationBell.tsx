"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/lib/types";

const ago = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút trước`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} giờ trước`;
  return `${Math.floor(m / 1440)} ngày trước`;
};

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read_at).length;

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    if (data) setItems(data as AppNotification[]);
  }, []);

  useEffect(() => {
    let alive = true;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !alive) return;
      await supabase.rpc("notify_expiring_vouchers"); // tạo thông báo voucher sắp hết hạn (nếu có)
      if (!alive) return;
      load();
      ch = supabase.channel("notif-" + session.user.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
          (p) => setItems((prev) => [p.new as AppNotification, ...prev.filter((x) => x.id !== (p.new as AppNotification).id)].slice(0, 20)))
        .subscribe();
    })();
    const t = setInterval(load, 60000); // phòng khi mất kết nối realtime
    return () => { alive = false; clearInterval(t); if (ch) supabase.removeChannel(ch); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function read(n: AppNotification) {
    setOpen(false);
    if (!n.read_at) {
      const at = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: at } : x)));
      await supabase.from("notifications").update({ read_at: at }).eq("id", n.id);
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    const at = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: at })));
    await supabase.from("notifications").update({ read_at: at }).is("read_at", null);
  }

  return (
    <div className="bell" ref={box}>
      <button type="button" className="bell-btn" onClick={() => setOpen((v) => !v)} aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ""}`} aria-expanded={open}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Thông báo">
          <div className="bell-head">
            <b>Thông báo</b>
            {unread > 0 && <button type="button" onClick={readAll}>Đọc hết</button>}
          </div>
          {items.length === 0 ? (
            <p className="bell-empty">Chưa có thông báo nào.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={"bell-item" + (n.read_at ? "" : " unread")} onClick={() => read(n)}>
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <time>{ago(n.created_at)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}