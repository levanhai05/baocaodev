"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { supabase } from "@/lib/supabase";
import "./stores.css";

type Store = { id: number; name: string; address: string; phone: string | null; hours: string | null; lat: number | null; lng: number | null };

const km = (a: [number, number], b: [number, number]) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const dist = (me: [number, number] | null, s: Store) => (me && s.lat != null && s.lng != null ? km(me, [s.lat, s.lng]) : null);

// Đọc giờ mở cửa dạng "9:00 - 22:00" hoặc "9h-22h"; không đọc được thì trả null (không hiện trạng thái)
function openNow(hours: string | null): boolean | null {
  const m = hours?.match(/(\d{1,2})\s*[:h]\s*(\d{2})?\s*[-–—]\s*(\d{1,2})\s*[:h]\s*(\d{2})?/i);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2] ?? 0);
  const b = Number(m[3]) * 60 + Number(m[4] ?? 0);
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  if (a === b) return true;
  return b > a ? now >= a && now < b : now >= a || now < b;
}

const Ic = ({ children }: { children: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IcPin = () => <Ic><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Ic>;
const IcClock = () => <Ic><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Ic>;
const IcPhone = () => <Ic><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Ic>;
const IcNav = () => <Ic><polygon points="3 11 22 2 13 21 11 13 3 11" /></Ic>;

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    supabase.from("stores").select("*").eq("active", true).order("id").then(({ data }) => {
      setStores((data ?? []) as Store[]); setLoaded(true);
    });
  }, []);

  function locate() {
    if (!navigator.geolocation) { setMsg("Trình duyệt không hỗ trợ định vị."); return; }
    setLocating(true); setMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe([p.coords.latitude, p.coords.longitude]); setLocating(false); },
      () => { setLocating(false); setMsg("Không lấy được vị trí. Hãy cho phép truy cập vị trí trên trình duyệt."); },
    );
  }
  const list = me ? [...stores].sort((a, b) => (dist(me, a) ?? 1e9) - (dist(me, b) ?? 1e9)) : stores;

  return (
    <>
      <Header />
      <main className="st">
        <section className="st-hero">
          <div style={{ position: "relative", zIndex: 1 }}>
            <span className="eyebrow">Hệ thống cửa hàng</span>
            <h1>Ghé Phố Burger gần bạn nhất</h1>
            <p>Chọn chi nhánh thuận tiện, bấm chỉ đường hoặc gọi ngay để đặt trước món.</p>
          </div>
          <div className="st-locate">
            <button className="btn" onClick={locate} disabled={locating}><IcPin />{locating ? "Đang định vị…" : "Tìm cửa hàng gần tôi"}</button>
            {me
              ? <small>Đã sắp xếp theo khoảng cách · <button className="st-reset" onClick={() => setMe(null)}>Bỏ sắp xếp</button></small>
              : <small>{loaded ? `${stores.length} cửa hàng đang mở bán` : "Đang tải danh sách…"}</small>}
          </div>
        </section>

        {msg && <p className="st-msg" role="alert">{msg}</p>}

        <div className="st-grid">
          {!loaded && <><div className="st-skel" /><div className="st-skel" /></>}
          {loaded && list.length === 0 && <div className="st-empty"><span>📍</span>Chưa có thông tin cửa hàng.</div>}
          {list.map((s, i) => {
            const d = dist(me, s);
            const near = !!me && i === 0 && d != null;
            const open = openNow(s.hours);
            const dest = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.address;
            return (
              <article key={s.id} className={"st-card" + (near ? " near" : "")}>
                <div className="st-top">
                  <span className="st-ic"><IcPin /></span>
                  <div>
                    <h3>{s.name}</h3>
                    <div className="st-tags">
                      {near && <span className="st-tag near">Gần nhất</span>}
                      {d != null && <span className="st-tag dist">Cách bạn {d.toFixed(1)} km</span>}
                      {open != null && <span className={"st-tag " + (open ? "open" : "closed")}>{open ? "Đang mở cửa" : "Đã đóng cửa"}</span>}
                    </div>
                  </div>
                </div>
                <div className="st-info">
                  <div><IcPin /><span>{s.address}</span></div>
                  {s.hours && <div><IcClock /><span>Giờ mở cửa: {s.hours}</span></div>}
                  {s.phone && <div><IcPhone /><span>{s.phone}</span></div>}
                </div>
                <div className="st-act">
                  <a className="go" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`} target="_blank" rel="noreferrer"><IcNav />Chỉ đường</a>
                  {s.phone && <a className="call" href={`tel:${s.phone}`}><IcPhone />Gọi ngay</a>}
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <CartDrawer />
    </>
  );
}