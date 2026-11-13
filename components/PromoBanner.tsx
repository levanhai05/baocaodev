"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PromoBanner({ freeShipFrom }: { freeShipFrom: number }) {
  // null = chưa biết đã đăng nhập hay chưa (ẩn nút để không bị nháy)
  const [user, setUser] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <section className="promo">
      <div className="promo-box">
        <div>
          <h2>Miễn phí giao hàng cho đơn từ {freeShipFrom.toLocaleString("vi-VN")}đ</h2>
          <p>
            {user ? "Mỗi 10.000đ nhận 1 điểm, 1 điểm đổi 1.000đ cho đơn sau." : "Đăng nhập để tích điểm: mỗi 10.000đ nhận 1 điểm, 1 điểm đổi 1.000đ cho đơn sau."}
          </p>
        </div>
        <Link href={user ? "/account" : "/login"} className="btn light" style={{ visibility: user === null ? "hidden" : "visible" }}>
          {user ? "Xem điểm của tôi" : "Đăng ký thành viên"}
        </Link>
      </div>
    </section>
  );
}