import type { Metadata } from "next";
import Script from "next/script";
import { CartProvider } from "@/components/CartProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phố Burger — Burger & gà rán giao tận nơi",
  description: "Đặt burger, gà rán, khoai chiên online. Làm nóng, giao nhanh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
        {process.env.NEXT_PUBLIC_TAWK_SRC && <Script src={process.env.NEXT_PUBLIC_TAWK_SRC} strategy="lazyOnload" />}
      </body>
    </html>
  );
}