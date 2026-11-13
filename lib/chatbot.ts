import { effectivePrice, onSale, vnd, type Category, type Product } from "./types";

type Kind = "main" | "side" | "drink" | "dessert" | "combo";
export type Reply = { text: string; items?: Product[]; total?: number; mult?: number };
export type Shop = { shipFee: number; freeShipFrom: number };

// Bỏ dấu tiếng Việt để so khớp từ khoá
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const price = (p: Product) => effectivePrice(p);
const KIND_LABEL: Record<Kind, string> = { main: "món chính", side: "món ăn kèm", drink: "đồ uống", dessert: "món tráng miệng", combo: "combo" };
const STOP = new Set(["toi", "minh", "muon", "mot", "cho", "co", "khong", "nao", "nhung", "voi", "cua", "the", "duoc", "nen", "hay", "giup", "goi", "mon", "uong", "doi", "nguoi", "nhom", "gia", "dinh", "dang", "thich", "can", "tim", "xem", "nhe", "oi", "ban", "bao", "nhieu"]);

export function respond(raw: string, products: Product[], categories: Category[], shop: Shop): Reply {
  const t = norm(raw).trim();
  const pool = products.filter((p) => p.is_available);
  if (!pool.length) return { text: "Thực đơn đang được cập nhật, bạn quay lại sau ít phút nhé." };

  // ---- Câu hỏi nhanh ngoài gợi ý món
  if (/^(xin chao|chao|hello|hi|alo|hey)\b/.test(t))
    return { text: "Chào bạn! Bạn đang thèm gì? Cho mình biết ngân sách, số người hoặc món thích, mình gợi ý ngay nhé." };
  if (/(cam on|thanks|thank you|tuyet voi)/.test(t)) return { text: "Không có gì ạ! Chúc bạn ngon miệng 🍔" };
  if (/(ship|giao hang|phi giao|van chuyen|bao lau)/.test(t))
    return { text: `Đơn nội thành thường giao trong khoảng 30 phút. Phí giao ${vnd(shop.shipFee)}, miễn phí cho đơn từ ${vnd(shop.freeShipFrom)}.` };
  if (/(thanh toan|chuyen khoan|\bqr\b|tien mat)/.test(t))
    return { text: "Bạn có thể trả tiền mặt khi nhận hàng hoặc chuyển khoản bằng mã QR sau khi đặt." };
  if (/(mo cua|may gio|gio mo|dong cua)/.test(t)) return { text: "Cửa hàng mở mỗi ngày từ 9:00 đến 22:00." };

  // ---- Đọc ngân sách, số người
  let budget: number | null = null, people: number | null = null;
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)*)\s*([a-z]*)/g)) {
    const num = m[1], unit = m[2];
    if (/^(nguoi|ban|suat|phan|thanh)/.test(unit)) { people = Math.min(20, parseInt(num, 10)); continue; }
    const isK = /^(k|nghin|ngan)/.test(unit);
    const n = isK ? parseFloat(num.replace(",", ".")) * 1000 : parseFloat(num.replace(/[.,](?=\d{3}(?!\d))/g, ""));
    if (isK || /^(d|vnd|dong)$/.test(unit) || n >= 1000) budget = n;
  }
  const g = t.match(/(?:nhom|gia dinh|team)\s*(?:co\s*)?(\d+)/);
  if (g) people = Math.min(20, parseInt(g[1], 10));

  const f = {
    hungry: /\b(doi|no|bung)\b|an nhieu|doi bung/.test(t),
    cheap: /\b(re|tiet kiem|binh dan|sinh vien)\b/.test(t) || (budget !== null && budget <= 60000),
    group: /\b(nhom|gia dinh|ban be|chia se|tiec|team)\b|dong nguoi/.test(t) || (people ?? 0) >= 3,
    popular: /(ban chay|noi tieng|ngon nhat|pho bien|duoc yeu thich|nhieu nguoi)/.test(t),
    sale: /(giam gia|khuyen mai|sale|uu dai)/.test(t),
    light: /(an nhe|it beo|giam can|healthy|thanh dam|an kieng|\bnhe\b)/.test(t),
    spicy: /\bcay\b/.test(t),
    veg: /(an chay|mon chay|do chay)/.test(t),
    any: /(an gi|goi y|khong biet|phan van|tu van|gi cung duoc|chon giup|chon dum|nhanh)/.test(t),
  };

  // ---- Phân loại món theo thực đơn thật
  const catName = new Map(categories.map((c) => [c.id, norm(c.name)]));
  const kindOf = (p: Product): Kind => {
    const c = catName.get(p.category_id ?? -1) ?? "", n = norm(p.name);
    if (/\b(kem|sundae|flan|pudding)\b/.test(n)) return "dessert";
    if (/combo/.test(c) || /combo/.test(n)) return "combo";
    if (/uong|nuoc|drink/.test(c)) return "drink";
    if (/khoai|salad|an kem|snack/.test(c) || /khoai|salad/.test(n)) return "side";
    return "main";
  };
  const kinds = new Set<Kind>();
  if (/\b(uong|nuoc|khat|coca|tra|giai nhiet)\b/.test(t)) kinds.add("drink");
  if (/(khoai|salad|an vat|snack|an kem)/.test(t)) kinds.add("side");
  if (/\b(kem|trang mieng|sundae)\b/.test(t)) kinds.add("dessert");
  if (/(burger|hamburger|\bga\b|ga ran|\bbo\b|banh mi)/.test(t)) kinds.add("main");
  if (/combo/.test(t)) kinds.add("combo");

  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w));
  const text = (p: Product) => norm(p.name + " " + (p.description ?? ""));

  const score = (p: Product) => {
    let s = 1 + (p.is_hot ? 2 : 0) + (onSale(p) ? 1.5 : 0);
    const x = text(p);
    if (f.spicy && /\bcay\b/.test(x)) s += 4;
    for (const w of words) if (x.includes(w)) s += 3;
    return s - price(p) / (f.cheap ? 20000 : 80000);
  };
  const fit = (p: Product) => !budget || price(p) <= budget;
  const top = (arr: Product[], n: number) => [...arr].sort((a, b) => score(b) - score(a)).slice(0, n);
  const cheapest = (arr: Product[]) => [...arr].sort((a, b) => price(a) - price(b))[0];
  const budgetTxt = budget ? ` trong ${vnd(budget)}` : "";

  // ---- 1. Đi nhóm
  if (f.group) {
    const combos = pool.filter((p) => kindOf(p) === "combo");
    const share = pool.filter((p) => /(chia se|nhom|gia dinh|\b[3-9] mieng)/.test(text(p)));
    const list = top([...new Map([...combos, ...share].map((p) => [p.id, p])).values()].filter(fit), 3);
    if (list.length) {
      return { text: `${people ? `Đi ${people} người` : "Đi nhóm"} thì gọi combo hoặc phần chia sẻ cho tiện và đỡ tốn nhé. Bạn xem mô tả từng món để chọn phần vừa đủ:`, items: list };
    }
    return { text: `Chưa có combo nào${budgetTxt}. Bạn thử tăng ngân sách, hoặc mình gợi ý món lẻ nhé.`, items: top(pool.filter((p) => kindOf(p) === "main"), 2) };
  }

  // ---- 2. Đang giảm giá
  if (f.sale) {
    const list = top(pool.filter((p) => onSale(p) && fit(p)), 3);
    return list.length
      ? { text: "Các món đang giảm giá hôm nay:", items: list }
      : { text: "Hiện chưa có món nào giảm giá. Bạn xem mục Ưu đãi T7 CN hoặc mã giảm giá ở trang chủ nhé. Mình gợi ý món bán chạy thay nhé:", items: top(pool.filter((p) => p.is_hot), 3) };
  }

  // ---- 3. Bán chạy
  if (f.popular) {
    const rank = (p: Product) => (["main", "combo"].includes(kindOf(p)) ? 0 : 1);
    const list = pool.filter((p) => p.is_hot && fit(p)).sort((a, b) => rank(a) - rank(b) || score(b) - score(a)).slice(0, 3);
    if (list.length) return { text: `Những món được gọi nhiều nhất${budgetTxt}:`, items: list };
  }

  // ---- 4. Ăn nhẹ / ăn chay
  if (f.light || f.veg) {
    const light = pool.filter((p) => ["side", "drink", "dessert"].includes(kindOf(p)) && fit(p));
    const s = (p: Product) => score(p) + (/salad/.test(text(p)) ? 5 : 0) + (/(it beo|mat|nhe)/.test(text(p)) ? 3 : 0);
    const list = [...light].sort((a, b) => s(b) - s(a)).slice(0, 3);
    if (list.length)
      return { text: f.veg ? "Thực đơn chưa ghi rõ món chay, bạn hỏi nhân viên để chắc chắn nhé. Mấy món nhẹ nhất là:" : "Muốn ăn nhẹ thì mình gợi ý:", items: list };
  }

  // ---- 5. Khách nói rõ loại món (gà, burger, khoai, nước, kem, combo)
  if (kinds.size) {
    const per = kinds.size === 1 ? 3 : 2;
    const refine = [/\bga\b/.test(t) && /\bga\b/, /burger|hamburger/.test(t) && /burger/, /\bbo\b/.test(t) && /\bbo\b/].filter(Boolean) as RegExp[];
    const pick = (k: Kind) => {
      const all = pool.filter((p) => kindOf(p) === k && fit(p));
      const narrowed = k === "main" && refine.length ? all.filter((p) => refine.some((r) => r.test(text(p)))) : all;
      return top(narrowed.length ? narrowed : all, per);
    };
    const list = [...kinds].flatMap(pick).slice(0, 4);
    if (list.length)
      return { text: `Mình tìm được ${[...kinds].map((k) => KIND_LABEL[k]).join(" và ")}${budgetTxt} cho bạn:`, items: list };
    const any = cheapest(pool.filter((p) => kinds.has(kindOf(p))));
    return { text: `Chưa có ${[...kinds].map((k) => KIND_LABEL[k]).join(" / ")}${budgetTxt}.${any ? ` Món rẻ nhất là ${any.name} (${vnd(price(any))}).` : ""}`, items: any ? [any] : undefined };
  }

  // ---- 6. Khách gõ tên món / nguyên liệu (phô mai, trứng, popcorn…)
  const named = words.length
    ? pool.map((p) => ({ p, n: words.filter((w) => text(p).includes(w)).length })).filter((x) => x.n > 0 && fit(x.p)).sort((a, b) => b.n - a.n || score(b.p) - score(a.p)).slice(0, 3).map((x) => x.p)
    : [];
  if (named.length && !f.hungry && !f.any && !f.cheap && !f.spicy) return { text: "Mình thấy mấy món khớp với bạn nè:", items: named };

  // ---- 7. Gợi ý một suất đủ bữa: món chính + ăn kèm + đồ uống
  if (f.hungry || f.cheap || f.any || f.spicy || budget || people) {
    const mains = pool.filter((p) => kindOf(p) === "main");
    const sides = pool.filter((p) => kindOf(p) === "side");
    const drinks = pool.filter((p) => kindOf(p) === "drink");
    const mult = people && people <= 2 ? people : 1;
    const cap = budget ? budget / mult : null;
    let best: Product[] | null = null, bestScore = -Infinity;
    for (const m of mains.length ? mains : [null])
      for (const s of [null, ...sides])
        for (const d of [null, ...drinks]) {
          const set = [m, s, d].filter(Boolean) as Product[];
          if (!set.length || (cap && set.reduce((a, p) => a + price(p), 0) > cap)) continue;
          const sc = set.reduce((a, p) => a + score(p), 0) + (m ? 5 : 0) + (s ? (f.hungry ? 3 : 2) : 0) + (d ? (f.hungry ? 3 : 2) : 0);
          if (sc > bestScore) { bestScore = sc; best = set; }
        }
    if (!best) {
      const min = cheapest(pool);
      return { text: `Ngân sách${budgetTxt} hơi thấp. Món rẻ nhất hiện có là ${min.name} (${vnd(price(min))}).`, items: [min] };
    }
    const sum = best.reduce((a, p) => a + price(p), 0);
    const intro = f.spicy ? "Bạn thích cay thì thử suất này nhé" : f.cheap ? "Ăn ngon mà không tốn nhiều, mình gợi ý" : f.hungry ? "Đói thì phải ăn cho đã, suất này đủ no" : "Mình gợi ý một suất đủ bữa";
    return { text: `${intro}${budgetTxt}:${mult > 1 ? `\nMỗi suất như vậy, bạn gọi x${mult} là đủ cho ${mult} người.` : ""}`, items: best, total: sum * mult, mult };
  }

  // ---- Không hiểu
  return { text: "Mình chưa hiểu rõ ý bạn 😅 Bạn thử bấm một gợi ý bên dưới, hoặc cho mình biết ngân sách, số người hay món bạn thích nhé." };
}