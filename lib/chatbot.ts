import { effectivePrice, onSale, vnd, type Category, type Product } from "./types";

type Kind = "main" | "side" | "drink" | "dessert" | "combo";
export type Reply = { text: string; items?: Product[]; total?: number; mult?: number };
export type Shop = { shipFee: number; freeShipFrom: number; hotline?: string; address?: string; isOpen?: boolean };

// Bỏ dấu tiếng Việt để so khớp từ khoá
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const price = (p: Product) => effectivePrice(p);
const KIND_LABEL: Record<Kind, string> = { main: "món chính", side: "món ăn kèm", drink: "đồ uống", dessert: "món tráng miệng", combo: "combo" };
const STOP = new Set(["toi", "minh", "muon", "mot", "cho", "co", "khong", "nao", "nhung", "voi", "cua", "the", "duoc", "nen", "hay", "giup", "goi", "mon", "uong", "doi", "nguoi", "nhom", "gia", "dinh", "dang", "thich", "can", "tim", "xem", "nhe", "oi", "ban", "bao", "nhieu"]);

// ================= Hỏi đáp ngoài chuyện chọn món =================
// Trả về null nếu câu hỏi không thuộc nhóm nào -> chuyển sang phần gợi ý món bên dưới.
function faq(t: string, shop: Shop, pool: Product[]): Reply | null {
  const is = (re: RegExp) => re.test(t);
  const hotline = shop.hotline ? `hotline ${shop.hotline}` : "hotline ghi ở cuối trang";
  const freeShip = shop.freeShipFrom > 0 ? `, miễn phí cho đơn từ ${vnd(shop.freeShipFrom)}` : "";

  // ---- Xã giao
  if (is(/^(xin chao|chao|hello|hi|alo|hey)\b/))
    return { text: "Chào bạn! Bạn đang thèm gì? Cho mình biết ngân sách, số người hoặc món thích, mình gợi ý ngay. Mình cũng trả lời được về giao hàng, thanh toán, mã giảm giá, theo dõi đơn nhé." };
  if (is(/^(ok|oke|okay|vang|da|duoc roi|uh|u)[\s!.]*$/)) return { text: "Vâng ạ! Cần gì thêm bạn cứ nhắn mình nhé 😊" };
  if (is(/(cam on|thanks|thank you|tuyet voi)/)) return { text: "Không có gì ạ! Chúc bạn ngon miệng 🍔" };
  if (is(/(tam biet|\bbye\b|hen gap lai)/)) return { text: "Hẹn gặp lại bạn! Khi nào đói cứ ghé nhé 🍔" };
  if (is(/(ban la ai|ban lam duoc gi|giup duoc gi|co the lam gi|\bbot\b|tro ly)/))
    return { text: "Mình là trợ lý của quán. Mình gợi ý món theo ngân sách, số người, khẩu vị, và trả lời về giờ mở cửa, địa chỉ, phí giao hàng, thanh toán, mã giảm giá, điểm thưởng, theo dõi đơn. Bạn cứ hỏi thử nhé!" };

  // ---- Thông tin quán
  if (is(/(mo cua|may gio|gio mo|dong cua|gio lam viec|gio hoat dong|con mo|dang mo)/))
    return { text: shop.isOpen === false
      ? "Quán đang tạm đóng cửa nên chưa nhận đơn online. Giờ mở cửa thường là 9:00 – 22:00 mỗi ngày, bạn quay lại sau nhé."
      : "Quán mở cửa mỗi ngày từ 9:00 đến 22:00 ✅" };
  if (is(/(dia chi|dia diem|chi nhanh|cua hang o|quan o|ghe quan|tim quan|duong nao)/))
    return { text: `${shop.address ? `Quán ở ${shop.address}. ` : ""}Mục Cửa hàng trên menu có danh sách chi nhánh và nút chỉ đường 📍` };
  if (is(/(hotline|so dien thoai|\bsdt\b|lien he|goi dien|\bzalo\b|gap nhan vien|nhan vien ho tro)/))
    return { text: `Bạn gọi ${hotline} để được nhân viên hỗ trợ nhé 📞` };

  // ---- Sự cố đơn hàng
  if (is(/(khieu nai|sai mon|mon sai|thieu mon|giao sai|hoan tien|nguoi lanh|do nguoi|bi nguoi|giao cham|giao tre|lau qua|mon bi hu|do an hu)/))
    return { text: `Mình rất tiếc về trải nghiệm này 🙏 Bạn gọi ${hotline} và đọc mã đơn để quán kiểm tra và xử lý cho bạn nhé.` };
  // ---- Theo dõi đơn
  if (is(/(theo doi don|tra cuu|don cua toi|kiem tra don|don hang dau|da giao chua|trang thai don|ma don|don hang cua)/))
    return { text: "Bạn vào mục Theo dõi đơn trên menu, nhập mã đơn (hiện ngay sau khi đặt) và số điện thoại đã dùng để đặt. Nếu lúc đặt bạn đã đăng nhập thì cũng xem được ở Tài khoản → Đơn đã đặt. Trạng thái đi theo thứ tự: Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao hàng → Đã giao thành công." };

  if (is(/(huy don|huy mon|doi don|sua don|doi dia chi|doi mon|thay doi don|bo don)/))
    return { text: `Hiện web chưa có nút tự huỷ hay sửa đơn. Bạn gọi ${hotline} càng sớm càng tốt để nhân viên hỗ trợ, đơn đã sang trạng thái Đang chuẩn bị thì có thể không đổi được.` };

  // ---- Nhận hàng
  if (is(/(nhan tai quan|tu den lay|den lay|tu lay|mang ve|pickup|hen gio|dat truoc|dat lich)/))
    return { text: `Ở giỏ hàng bạn chọn "Tự đến lấy" (miễn phí giao hàng${shop.address ? `, nhận tại ${shop.address}` : ""}) và tick "Hẹn giờ nhận món" để chọn giờ lấy. Nhớ chọn giờ trong khung mở cửa 9:00 – 22:00 nhé.` };
  if (is(/(ship|giao hang|phi giao|van chuyen|bao lau|giao toi|giao ve|noi thanh)/))
    return { text: `Quán giao hàng nội thành, thường trong khoảng 30 phút. Phí giao ${vnd(shop.shipFee)}${freeShip}. Bạn cũng có thể chọn "Tự đến lấy" để khỏi tốn phí giao.` };

  // ---- Thanh toán, mã giảm giá, điểm
  if (is(/(thanh toan|chuyen khoan|\bqr\b|tien mat|\bcod\b|momo|visa|quet the|the tin dung|the atm|vnpay|ngan hang|tra tien|so tai khoan|\bstk\b)/))
    return { text: "Hiện có 2 cách thanh toán: tiền mặt khi nhận hàng, hoặc chuyển khoản bằng mã QR hiện ra ngay sau khi đặt. Web chưa hỗ trợ ví điện tử hay quẹt thẻ." };
  if (is(/(ma giam gia|coupon|voucher|nhap ma|ma khuyen mai|ma uu dai|code giam)/))
    return { text: "Bạn nhập mã vào ô Mã giảm giá ở giỏ hàng rồi bấm Áp dụng. Mỗi tài khoản dùng mỗi mã 1 lần, một số mã có đơn tối thiểu và hạn dùng. Các mã đang có hiển thị ở trang chủ. Còn voucher thì đổi từ điểm thưởng ở mục Tài khoản, chọn voucher ngay ở giỏ hàng khi đặt." };
  if (is(/(diem thuong|tich diem|diem tich luy|doi diem|\bdiem\b)/))
    return { text: "Bạn nhận 1 điểm cho mỗi 10.000đ khi đơn hoàn thành (cần đăng nhập lúc đặt). Điểm dùng để đổi voucher giảm giá ở mục Tài khoản, mỗi voucher dùng cho 1 đơn." };
  if (is(/(uu dai cuoi tuan|cuoi tuan|\bt7\b|chu nhat|gio vang|flash sale)/)) {
    const sale = pool.filter(onSale).slice(0, 3);
    return { text: `Quán có ưu đãi cuối tuần (Thứ 7 & Chủ Nhật) và các món giảm giá theo giờ ngay trên trang chủ, có đồng hồ đếm ngược.${sale.length ? " Một số món đang giảm:" : ""}`, items: sale.length ? sale : undefined };
  }

  // ---- Đặt hàng, tài khoản
  if (is(/(cach dat|dat hang nhu the nao|dat sao|lam sao dat|huong dan|order|dat mon nhu)/))
    return { text: "Cách đặt: chọn món (có thể chọn size, topping, ghi chú riêng) → thêm vào giỏ → vào giỏ hàng nhập tên, số điện thoại, địa chỉ → chọn cách thanh toán → Đặt hàng. Bạn cần đăng nhập để đặt." };
  if (is(/(ghi chu|bo hanh|khong hanh|yeu cau dac biet)/))
    return { text: 'Bạn ghi yêu cầu vào ô "Ghi chú riêng" khi chọn từng món (VD: ít cay, không hành), hoặc ô "Ghi chú" của cả đơn ở giỏ hàng nhé.' };
  if (is(/(di ung|nguyen lieu|thanh phan|halal|gluten|hai san|dau phong|\bcalo)/))
    return { text: `Thực đơn chưa ghi chi tiết thành phần hay dị ứng. Bạn gọi ${hotline} hỏi trước khi đặt, hoặc ghi chú rõ trong đơn để quán lưu ý nhé.` };
  if (is(/(dang ky|dang nhap|tai khoan|quen mat khau|mat khau|doi mat khau)/))
    return { text: 'Bạn bấm Đăng nhập trên menu (chưa có tài khoản thì chọn đăng ký). Quên mật khẩu thì bấm "Quên mật khẩu?" ở trang đăng nhập, link đặt lại sẽ gửi vào email của bạn.' };
  if (is(/(danh gia|review|yeu thich)/))
    return { text: "Bạn bấm vào món để xem và gửi đánh giá. Bấm biểu tượng trái tim trên món để lưu vào mục Yêu thích, lọc lại ở thực đơn cho nhanh." };

  return null;
}

export function respond(raw: string, products: Product[], categories: Category[], shop: Shop): Reply {
  const t = norm(raw).trim();
  const pool = products.filter((p) => p.is_available);

  // ---- Hỏi đáp chung (giờ mở cửa, giao hàng, thanh toán, mã giảm giá…)
  const answer = faq(t, shop, pool);
  if (answer) return answer;

  if (!pool.length) return { text: "Thực đơn đang được cập nhật, bạn quay lại sau ít phút nhé." };

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
  return { text: "Mình chưa hiểu rõ ý bạn 😅 Bạn thử bấm một gợi ý bên dưới, cho mình biết ngân sách, số người, món bạn thích, hoặc hỏi về giao hàng, thanh toán, mã giảm giá, theo dõi đơn nhé." };
}