export type Category = { id: number; name: string; sort: number };
export type OptionGroup = { name: string; required: boolean; multi: boolean; choices: { name: string; price: number }[] };
export type Product = {
  id: number; category_id: number | null; name: string; description: string | null;
  price: number; emoji: string; image_url: string | null; is_hot: boolean; is_available: boolean;
  options?: OptionGroup[] | null; sale_price?: number | null; sale_until?: string | null; cost?: number | null;
};
export type OrderItem = { id: number; name: string; price: number; qty: number; options?: string | null; note?: string | null; cost?: number | null };
export type Order = {
  id: string; code: string; customer_name: string; phone: string; address: string; note: string | null;
  payment_method: string; payment_status: string; shipping_fee: number; total: number; status: string;
  discount?: number; coupon_code?: string | null; points_used?: number; voucher_discount?: number; fulfillment?: string; scheduled_for?: string | null;
  created_at: string; order_items: OrderItem[];
};
export type Voucher = { id: string; code: string; amount: number; min_order: number; expires_at: string; used_at: string | null; created_at: string };
export type AppNotification = { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
export type RewardTier = { id: number; points: number; amount: number; min_order: number; valid_days: number };
export type Settings = {
  shop_name: string; hotline: string; address: string; ship_fee: number; free_ship_from: number;
  is_open: boolean; banner_text: string | null;
};
export const DEFAULT_SETTINGS: Settings = {
  shop_name: "Phố Burger", hotline: "0900 000 000", address: "Số 1, Đường ABC, Quận X",
  ship_fee: 15000, free_ship_from: 150000, is_open: true, banner_text: null,
};

export const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
export const FREE_SHIP = 150000;
export const SHIP_FEE = 15000;
export const STATUS: Record<string, string> = {
  new: "Chờ xác nhận", confirmed: "Đã xác nhận", preparing: "Đang chuẩn bị", delivering: "Đang giao hàng",
  done: "Đã giao thành công", cancelled: "Đã huỷ",
};
export const PAY: Record<string, string> = {
  cod: "Tiền mặt khi nhận hàng", bank: "Chuyển khoản",
};
export const PAY_STATUS: Record<string, string> = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", failed: "Thanh toán lỗi" };

type P = Pick<Product, "price" | "sale_price" | "sale_until">;
export const onSale = (p: P) => !!p.sale_price && p.sale_price < p.price && (!p.sale_until || new Date(p.sale_until) > new Date());
export const effectivePrice = (p: P) => (onSale(p) ? (p.sale_price as number) : p.price);
export const stars = (n: number) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

// Định dạng nhập ở admin, mỗi dòng 1 nhóm:  Size*: Vừa=0 | Lớn=10000     (* bắt buộc, + chọn nhiều)
export function parseOptions(t: string): OptionGroup[] | null {
  const groups = t.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf(":");
    const head = i < 0 ? line : line.slice(0, i);
    const rest = i < 0 ? "" : line.slice(i + 1);
    const flags = head.match(/[*+]+$/)?.[0] ?? "";
    const choices = rest.split("|").map((s) => s.trim()).filter(Boolean).map((s) => {
      const [n, pr] = s.split("=");
      return { name: n.trim(), price: Number(pr) || 0 };
    });
    return { name: head.replace(/[*+]+$/, "").trim(), required: flags.includes("*"), multi: flags.includes("+"), choices };
  }).filter((g) => g.name && g.choices.length);
  return groups.length ? groups : null;
}
export const stringifyOptions = (o: OptionGroup[] | null | undefined) =>
  (o ?? []).map((g) => `${g.name}${g.required ? "*" : ""}${g.multi ? "+" : ""}: ${g.choices.map((c) => `${c.name}=${c.price}`).join(" | ")}`).join("\n");