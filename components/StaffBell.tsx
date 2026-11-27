"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";

type Alert = { id: number; kind: string; text: string; code: string; at: number };

// Bíp ngắn bằng Web Audio, không cần file âm thanh.
function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* trình duyệt chặn âm thanh -> bỏ qua */ }
}

// Cuộn tới thẻ đơn có mã tương ứng và nháy viền; nếu đang bị lọc ẩn thì chuyển về "Tất cả".
function openOrder(code: string, tries = 0) {
  const find = () =>
    Array.from(document.querySelectorAll<HTMLElement>("main article, .orders article")).find((a) => a.textContent?.includes("#" + code));
  const el = find();
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const old = el.style.boxShadow;
    el.style.boxShadow = "0 0 0 3px #ea580c, 0 10px 30px #ea580c55";
    setTimeout(() => { el.style.boxShadow = old; }, 2500);
    return;
  }
  if (tries >= 3) return;
  if (tries === 0) {
    Array.from(document.querySelectorAll<HTMLButtonElement>("main button, .tabs button")).find((b) => b.textContent?.trim() === "Tất cả")?.click();
    window.dispatchEvent(new Event("staff-refresh"));
  }
  setTimeout(() => openOrder(code, tries + 1), 700);
}

const ICON: Record<string, string> = { new_order: "🧾", order_start: "👨‍🍳", order_ready: "✅", delivering: "🛵", delivered: "🎉" };
const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? "Vừa xong" : m < 60 ? `${m} phút trước` : `${Math.floor(m / 60)} giờ trước`;
};

// channel: kênh broadcast của vai trò hiện tại (bếp: theo chi nhánh, shipper: theo user)
export default function StaffBell({ channel, admin = false }: { channel: string; admin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<Alert[]>([]);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Alert | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Admin đang ở trang khác thì chuyển về trang Đơn hàng trước khi cuộn tới đơn
  const go = (code: string) => {
    if (admin && pathname !== "/admin") router.push("/admin");
    openOrder(code);
  };
  const unread = items.filter((i) => i.id > seen).length;

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    const ch = supabase.channel(channel)
      .on("broadcast", { event: "alert" }, ({ payload }) => {
        const a: Alert = { id: Date.now(), kind: payload.kind, text: payload.text, code: payload.code, at: Date.now() };
        setItems((p) => [a, ...p].slice(0, 20));
        setToast(a); setTimeout(() => setToast((t) => (t?.id === a.id ? null : t)), 6000);
        beep();
        window.dispatchEvent(new Event("staff-refresh")); // để trang bếp/shipper tải lại danh sách ngay
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden)
          new Notification("Phố Burger", { body: payload.text });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channel]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="bell" ref={box}>
      <button type="button" className="bell-btn" aria-label={`Thông báo${unread ? ` (${unread} mới)` : ""}`}
        onClick={() => { setOpen((v) => !v); setSeen(Date.now()); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Thông báo" style={admin ? { right: 0 } : undefined}>
          <div className="bell-head"><b>Thông báo</b></div>
          {items.length === 0 ? <p className="bell-empty">Chưa có thông báo nào.</p> : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}><button type="button" className="bell-item" onClick={() => { setOpen(false); go(n.code); }}><b>{ICON[n.kind] ?? "🔔"} {n.text}</b><span>Mã đơn #{n.code} · Bấm để xem đơn →</span><time>{ago(n.at)}</time></button></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {toast && (
        <div role="status" onClick={() => { go(toast.code); setToast(null); }} style={{ cursor: "pointer", position: "fixed", top: 76, right: 20, zIndex: 100, background: "#1a1a1a", color: "#fff", padding: "14px 18px", borderRadius: 12, boxShadow: "0 12px 30px #0004", font: "700 13px Arial, sans-serif", maxWidth: 300 }}>
          {ICON[toast.kind] ?? "🔔"} {toast.text}<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>Mã đơn #{toast.code} · Bấm để xem</span>
        </div>
      )}
    </div>
  );
}