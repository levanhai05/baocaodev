"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";
import { vnd } from "@/lib/types";

// Giỏ hàng giờ là trang riêng (/cart). Component này chỉ còn thông báo "đã thêm món"
// và thanh nổi dẫn tới giỏ hàng, nên các trang đang dùng <CartDrawer /> vẫn chạy bình thường.
export default function CartDrawer() {
  const { count, total, toast } = useCart();
  const path = usePathname();
  return (
    <>
      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {count > 0 && path !== "/cart" && (
        <Link href="/cart" className="cartbar">
          <span>{count} món</span><b>Xem giỏ hàng · {vnd(total)}</b>
        </Link>
      )}
    </>
  );
}