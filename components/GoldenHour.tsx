"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const pad = (n: number) => String(n).padStart(2, "0");

function useCountdown(until: string | null) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!until) return;
    const end = new Date(until).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); router.refresh(); }
    };
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [until, router]);

  return left;
}

// Đồng hồ nhỏ dưới từng món (dùng khi các món hết hạn ở giờ khác nhau)
export function DealTimer({ until }: { until: string }) {
  const left = useCountdown(until);
  const txt = left === null ? "--:--:--" : `${left >= 86400 ? Math.floor(left / 86400) + " ngày " : ""}${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return <div className="gh-mini">⏱ Còn <b>{txt}</b></div>;
}

export default function GoldenHour({ until }: { until: string | null }) {
  const left = useCountdown(until);

  const d = left === null ? null : Math.floor(left / 86400);
  const h = left === null ? null : Math.floor((left % 86400) / 3600);
  const m = left === null ? null : Math.floor((left % 3600) / 60);
  const s = left === null ? null : left % 60;
  const box = (v: number | null, label: string) => (
    <div className="gh-unit"><b>{v === null ? "--" : pad(v)}</b><small>{label}</small></div>
  );

  return (
    <div className="gh-head">
      <div className="gh-left">
        <span className="eyebrow gh-eyebrow">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s1 3.5-1.5 6C8 10.5 6 12.5 6 15.5A6 6 0 0 0 18 15.5c0-2-1-3.5-2-4.5 0 1.5-.8 2.5-1.8 2.5C15 10 14 5 12 2Z" fill="currentColor"/><path d="M12 22a3.2 3.2 0 0 1-3.2-3.2c0-1.6 1.4-2.6 2.2-4 .3 1 1 1.4 1.6 1.4.9 0 1.7.9 1.7 2.2A2.9 2.9 0 0 1 12 22Z" fill="#ffd23f"/></svg>
          Ưu đãi hôm nay
        </span>
        <div className="gh-titlerow">
          <h2 className="sec-title">Khung giờ <em>vàng</em></h2>
          <svg className="gh-clock" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="ghg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd23f"/><stop offset="1" stopColor="#f59a1b"/></linearGradient>
            </defs>
            <circle cx="24" cy="20" r="13" fill="url(#ghg)"/><circle cx="76" cy="20" r="13" fill="url(#ghg)"/>
            <path d="M34 90 28 98M66 90l6 8" stroke="#f59a1b" strokeWidth="6" strokeLinecap="round"/>
            <circle cx="50" cy="56" r="37" fill="url(#ghg)"/>
            <circle cx="50" cy="56" r="29" fill="#fff"/>
            <g stroke="#e0a43a" strokeWidth="2.5" strokeLinecap="round"><path d="M50 32v4M50 76v4M26 56h4M70 56h4"/></g>
            <path d="M50 56 50 40M50 56l13 8" stroke="#8a3b12" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="50" cy="56" r="3.5" fill="#8a3b12"/>
            <path d="M16 8 10 2M84 8l6-6M50 10V2" stroke="#ffc83a" strokeWidth="3.5" strokeLinecap="round"/>
          </svg>
          <span className="gh-spark" aria-hidden="true">✦</span>
        </div>
        <div className="gh-ribbonrow">
          <span className="gh-ticket" aria-hidden="true">%</span>
          <p className="gh-ribbon">Đặt món ngay – Nhận ưu đãi <b>cực lớn!</b></p>
        </div>
      </div>
      {until && (
        <div className="gh-count" aria-live="off">
          <span className="gh-label">Chỉ còn:</span>
          <div className="gh-units">
            {d !== null && d > 0 && <>{box(d, "Ngày")}<i>:</i></>}
            {box(h, "Giờ")}<i>:</i>{box(m, "Phút")}<i>:</i>{box(s, "Giây")}
          </div>
        </div>
      )}
    </div>
  );
}