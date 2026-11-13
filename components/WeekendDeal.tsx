"use client";
import { useEffect, useState } from "react";

const VN = 7 * 3600e3; // múi giờ Việt Nam (UTC+7), không phụ thuộc máy khách
const DAY = 86400e3;
const pad = (n: number) => String(n).padStart(2, "0");

// Đang trong Thứ 7 / Chủ Nhật không? và còn bao nhiêu giây tới lúc bắt đầu / kết thúc
function state(now: number) {
  const vn = now + VN;
  const dayStart = Math.floor(vn / DAY) * DAY;
  const dow = new Date(vn).getUTCDay(); // 0 = CN, 6 = T7
  const active = dow === 6 || dow === 0;
  const target = active ? dayStart + (dow === 6 ? 2 : 1) * DAY : dayStart + (6 - dow) * DAY;
  return { active, left: Math.max(0, Math.floor((target - VN - now) / 1000)) };
}

export default function WeekendDeal() {
  const [s, setS] = useState<{ active: boolean; left: number } | null>(null);
  useEffect(() => {
    const tick = () => setS(state(Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const left = s?.left ?? null;
  const d = left === null ? null : Math.floor(left / 86400);
  const h = left === null ? null : Math.floor((left % 86400) / 3600);
  const m = left === null ? null : Math.floor((left % 3600) / 60);
  const sec = left === null ? null : left % 60;
  const box = (v: number | null, label: string) => (
    <div className="gh-unit"><b>{v === null ? "--" : pad(v)}</b><small>{label}</small></div>
  );

  return (
    <section className="shelf wk">
      <span className="eyebrow">Ưu đãi đặc biệt</span>
      <h2 className="sec-title">Ưu đãi <em>T7 CN</em></h2>

      <div className="wk-card">
        <div className="wk-hero">
          <div className="wk-text">
            <span className="wk-cal">Thứ 7 &amp; Chủ Nhật</span>
            <div><span className="wk-give">Giảm ngay</span></div>
            <div className="wk-big">10K</div>
            <p className="wk-dash">Cho tất cả <u>mọi đơn</u></p>
          </div>
          <img className="wk-img" src="https://images.unsplash.com/photo-1550547660-d9450f859349?w=900&q=85" alt="Burger và khoai chiên" loading="lazy" />
        </div>

        <div className="wk-bar">
          <div className="wk-when">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" strokeWidth="2.4" />
            </svg>
            <div><small>Áp dụng vào</small><b>Thứ 7 &amp; Chủ Nhật</b></div>
          </div>

          <div className="wk-count" aria-live="off">
            <span className={"wk-status" + (s?.active ? " on" : "")}><i />{s === null ? "…" : s.active ? "Đang diễn ra" : "Sắp diễn ra"}</span>
            <span className="wk-label">{s?.active ? "Kết thúc sau:" : "Bắt đầu sau:"}</span>
            <div className="gh-units">
              {d !== null && d > 0 && <>{box(d, "Ngày")}<i>:</i></>}
              {box(h, "Giờ")}<i>:</i>{box(m, "Phút")}<i>:</i>{box(sec, "Giây")}
            </div>
          </div>

          <a className="btn" href="#menu">{s?.active ? "Đặt món ngay →" : "Xem thực đơn →"}</a>
        </div>
      </div>
    </section>
  );
}