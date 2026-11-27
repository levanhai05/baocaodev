
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { LogoMark } from "@/components/Logo";
import { unitOf, useCart, type Line } from "@/components/CartProvider";
import ProductModal from "@/components/ProductModal";
import { supabase } from "@/lib/supabase";
import BankTransfer from "@/components/BankTransfer";
import { vnd, type Voucher } from "@/lib/types";
import "./cart.css";

// Gửi kèm token đăng nhập để server xác định khách hàng
async function authFetch(url: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(
    url,
    session
      ? {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      : undefined
  );
}

type Profile = {
  id?: string;
  full_name?: string;
  phone?: string;
  address?: string;
  points?: number;
};

type SavedAddress = {
  id: number;
  label: string;
  address: string;
  is_default: boolean;
};

export default function CartPage() {
  const { lines, count, total, settings, change, clear } = useCart();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [done, setDone] = useState<{
    code: string;
    total: number;
    payment: string;
  } | null>(null);

  const [prof, setProf] = useState<Profile>({});
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    discount: number;
  } | null>(null);

  const [couponMsg, setCouponMsg] = useState("");
  const [pickup, setPickup] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherId, setVoucherId] = useState("");
  const [addrs, setAddrs] = useState<SavedAddress[]>([]);
  const [addr, setAddr] = useState("");
  const [editing, setEditing] = useState<Line | null>(null);

  // Tính toán đơn hàng
  const discount = applied?.discount ?? 0;

  const ship =
    pickup || total >= settings.free_ship_from
      ? 0
      : settings.ship_fee;

  const voucher = vouchers.find((v) => v.id === voucherId);

  const voucherOk =
    !!voucher && total - discount >= voucher.min_order;

  const voucherDiscount =
    voucher && voucherOk
      ? Math.min(voucher.amount, total - discount)
      : 0;

  const grand = Math.max(
    0,
    total - discount - voucherDiscount + ship
  );

  const shipLeft = Math.max(
    0,
    settings.free_ship_from - total
  );

  const shipPct =
    settings.free_ship_from > 0
      ? Math.min(
          100,
          Math.round((total / settings.free_ship_from) * 100)
        )
      : 100;

  // Lấy thông tin tài khoản, voucher và địa chỉ đã lưu
  useEffect(() => {
    let active = true;

    async function loadCustomerData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !active) return;

      const [profileResult, voucherResult, addressResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .maybeSingle(),

          supabase
            .from("vouchers")
            .select("*")
            .is("used_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at"),

          supabase
            .from("addresses")
            .select("*")
            .order("is_default", { ascending: false })
            .order("id"),
        ]);

      if (!active) return;

      if (profileResult.data) {
        const profile = profileResult.data as Profile;
        setProf(profile);
        setAddr((current) => current || profile.address || "");
      }

      if (voucherResult.data) {
        setVouchers(voucherResult.data as Voucher[]);
      }

      if (addressResult.data) {
        const savedAddresses =
          addressResult.data as SavedAddress[];

        setAddrs(savedAddresses);

        const defaultAddress = savedAddresses.find(
          (item) => item.is_default
        );

        if (defaultAddress) {
          setAddr((current) => current || defaultAddress.address);
        }
      }
    }

    loadCustomerData();

    return () => {
      active = false;
    };
  }, []);

  // Kiểm tra lại mã giảm giá khi tổng tiền thay đổi
  useEffect(() => {
    if (!applied) return;

    let active = true;

    async function validateCoupon() {
      try {
        const response = await authFetch(
          `/api/coupon?code=${encodeURIComponent(
            applied!.code
          )}&subtotal=${total}`
        );

        const data = await response.json();

        if (!active) return;

        if (data.ok) {
          setApplied({
            code: data.code,
            discount: data.discount,
          });
        } else {
          setApplied(null);
          setCouponMsg(
            data.error ?? "Mã giảm giá không còn hợp lệ."
          );
        }
      } catch {
        if (active) {
          setCouponMsg("Không thể kiểm tra mã giảm giá.");
        }
      }
    }

    validateCoupon();

    return () => {
      active = false;
    };
    // Chỉ kiểm tra lại khi tổng tiền thay đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Áp dụng mã giảm giá
  async function applyCoupon() {
    if (!couponInput.trim()) {
      setCouponMsg("Vui lòng nhập mã giảm giá.");
      return;
    }

    setCouponMsg("");

    try {
      const response = await authFetch(
        `/api/coupon?code=${encodeURIComponent(
          couponInput.trim()
        )}&subtotal=${total}`
      );

      const data = await response.json();

      if (data.ok) {
        setApplied({
          code: data.code,
          discount: data.discount,
        });

        setCouponMsg(
          data.description ?? "Đã áp dụng mã giảm giá."
        );
      } else {
        setApplied(null);
        setCouponMsg(
          data.error ?? "Mã giảm giá không hợp lệ."
        );
      }
    } catch {
      setCouponMsg(
        "Không thể kết nối máy chủ. Vui lòng thử lại."
      );
    }
  }

  // Đặt hàng
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    if (lines.length === 0) {
      setError("Giỏ hàng đang trống.");
      return;
    }

    if (!settings.is_open) {
      setError("Cửa hàng đang tạm đóng cửa.");
      return;
    }

    if (voucherId && voucher && !voucherOk) {
      setError(
        `Voucher chỉ áp dụng cho đơn từ ${vnd(voucher.min_order)}.`
      );
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payment = String(formData.get("payment") ?? "cod");
    const phone = String(formData.get("phone") ?? "").trim();

    // Đơn Pickup sử dụng địa chỉ cửa hàng
    const orderAddress = pickup
      ? settings.address
      : String(formData.get("address") ?? "").trim();

    if (!phone) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }

    if (!pickup && !orderAddress) {
      setError("Vui lòng nhập địa chỉ giao hàng.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          name: formData.get("name"),
          phone,
          address: orderAddress,
          note: formData.get("note"),
          payment,
          website: formData.get("website"),

          coupon: applied?.code ?? null,

          fulfillment: pickup ? "pickup" : "delivery",

          scheduled_for: scheduled
            ? formData.get("time")
            : null,

          voucher:
            voucherDiscount > 0 ? voucherId : null,

          items: lines.map((line) => ({
            id: line.product.id,
            qty: line.qty,
            picks: line.picks,
            note: line.note,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ??
            "Đặt hàng thất bại. Vui lòng thử lại."
        );
        return;
      }

      if (!data.code || typeof data.total !== "number") {
        setError(
          "Máy chủ trả về dữ liệu đơn hàng không hợp lệ."
        );
        return;
      }

      clear();

      setApplied(null);
      setCouponInput("");
      setCouponMsg("");

      if (voucherId) {
        setVouchers((current) =>
          current.filter((item) => item.id !== voucherId)
        );

        setVoucherId("");
      }

      setDone({
        code: data.code,
        total: data.total,
        payment,
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error("Checkout error:", err);

      setError(
        "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />

      <main className="cart-page">
        <div className="cart-head">
          <Link href="/#menu" className="back">
            ← Tiếp tục chọn món
          </Link>

          <h1>
            {done ? "Đặt hàng thành công" : "Giỏ hàng"}
          </h1>

          {count > 0 && !done && (
            <span className="dr-count">{count} món</span>
          )}
        </div>

        {done ? (
          <div className="done-card">
            <span className="empty-ic">
              <LogoMark size={46} />
            </span>

            <p>Đã nhận đơn! Mã đơn của bạn:</p>

            <p className="code">{done.code}</p>

            {done.payment === "bank" && (
              <BankTransfer
                code={done.code}
                total={done.total}
              />
            )}

            <p>
              Dùng mã này và số điện thoại để theo dõi đơn hàng.
            </p>

            <div className="done-actions">
              <Link
                href={`/track?code=${encodeURIComponent(done.code)}`}
                className="btn"
              >
                Theo dõi đơn ↗
              </Link>

              <Link href="/#menu" className="btn ghost">
                Đặt thêm món
              </Link>
            </div>
          </div>
        ) : lines.length === 0 ? (
          <div className="empty">
            <span className="empty-ic">
              <LogoMark size={46} />
            </span>

            <h3>Giỏ hàng đang trống</h3>

            <p>
              Chọn vài món ngon từ thực đơn để bắt đầu nhé.
            </p>

            <Link href="/#menu" className="btn">
              Xem thực đơn ↗
            </Link>
          </div>
        ) : (
          <div className="cart-grid">
            <section className="cart-main">
              {!settings.is_open && (
                <p className="notice error">
                  Cửa hàng đang tạm đóng cửa, hiện chưa nhận đơn.
                </p>
              )}

              {!pickup && settings.free_ship_from > 0 && (
                <div className="shipbar">
                  <p>
                    {shipLeft > 0 ? (
                      <>
                        Mua thêm <b>{vnd(shipLeft)}</b> để được{" "}
                        <b>miễn phí giao hàng</b>
                      </>
                    ) : (
                      <>
                        ✓ Đơn của bạn được{" "}
                        <b>miễn phí giao hàng</b>
                      </>
                    )}
                  </p>

                  <div className="shipbar-track">
                    <i style={{ width: `${shipPct}%` }} />
                  </div>
                </div>
              )}

              <ul className="lines">
                {lines.map((line) => (
                  <li key={line.key}>
                    {line.product.image_url ? (
                      <img
                        src={line.product.image_url}
                        alt={line.product.name}
                        className="cart-thumb"
                      />
                    ) : (
                      <span className="cart-thumb emoji">
                        {line.product.emoji}
                      </span>
                    )}

                    <div className="ln-info">
                      <strong>{line.product.name}</strong>

                      {line.label && (
                        <small className="sub">
                          {line.label}
                        </small>
                      )}

                      {line.note && (
                        <small className="sub">
                          <i>“{line.note}”</i>
                        </small>
                      )}

                      <small className="sub">
                        {vnd(unitOf(line))} / phần
                      </small>

                      {(line.product.options?.length ?? 0) > 0 && (
                        <button
                          type="button"
                          className="link edit-opt"
                          onClick={() => setEditing(line)}
                        >
                          Đổi tùy chọn
                        </button>
                      )}
                    </div>

                    <div className="ln-right">
                      <b>{vnd(line.qty * unitOf(line))}</b>

                      <span className="qty">
                        <button
                          type="button"
                          onClick={() => change(line.key, -1)}
                          aria-label="Giảm số lượng"
                        >
                          −
                        </button>

                        {line.qty}

                        <button
                          type="button"
                          onClick={() => change(line.key, 1)}
                          aria-label="Tăng số lượng"
                        >
                          +
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <form
                id="checkout"
                className="checkout"
                onSubmit={submit}
                key={prof.id ?? "guest"}
              >
                <input
                  name="website"
                  className="hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="cap">Thông tin đặt hàng</div>

                <div className="cf-row">
                  <label>
                    Họ tên
                    <input
                      name="name"
                      required
                      defaultValue={prof.full_name ?? ""}
                    />
                  </label>

                  <label>
                    Số điện thoại
                    <input
                      name="phone"
                      required
                      inputMode="tel"
                      pattern="[0-9+ ]{9,13}"
                      defaultValue={prof.phone ?? ""}
                    />
                  </label>
                </div>

                {pickup ? (
                  <p className="notice">
                    Nhận tại: {settings.address}
                  </p>
                ) : (
                  <>
                    {addrs.length > 0 && (
                      <label>
                        Địa chỉ đã lưu

                        <select
                          value={addr}
                          onChange={(e) => setAddr(e.target.value)}
                        >
                          <option value="">
                            — Chọn địa chỉ đã lưu —
                          </option>

                          {addrs.map((item) => (
                            <option
                              key={item.id}
                              value={item.address}
                            >
                              {item.label}: {item.address}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label>
                      Địa chỉ giao hàng

                      <input
                        name="address"
                        required
                        value={addr}
                        onChange={(e) => setAddr(e.target.value)}
                      />
                    </label>
                  </>
                )}

                <label className="check">
                  <input
                    type="checkbox"
                    checked={scheduled}
                    onChange={(e) =>
                      setScheduled(e.target.checked)
                    }
                  />
                  Hẹn giờ nhận món
                </label>

                {scheduled && (
                  <label>
                    Giờ nhận
                    <input
                      name="time"
                      type="time"
                      required
                    />
                  </label>
                )}

                <label>
                  Ghi chú
                  <input
                    name="note"
                    placeholder="Ví dụ: ít cay, gọi trước khi giao…"
                  />
                </label>

                <div className="pay">
                  <div className="cap">Thanh toán</div>

                  {(
                    [
                      ["cod", "Tiền mặt", "Trả khi nhận hàng"],
                      [
                        "bank",
                        "Chuyển khoản",
                        "Quét mã QR sau khi đặt",
                      ],
                    ] as const
                  ).map(([value, title, description], index) => (
                    <label key={value} className="pay-opt">
                      <input
                        type="radio"
                        name="payment"
                        value={value}
                        defaultChecked={index === 0}
                      />

                      <span className="po">
                        <b>{title}</b>
                        <small>{description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </form>
            </section>

            <aside
              className="cart-side"
              aria-label="Tóm tắt đơn hàng"
            >
              <div className="box">
                <div className="cap">Ưu đãi</div>

                <div className="coupon">
                  <input
                    value={couponInput}
                    onChange={(e) =>
                      setCouponInput(e.target.value)
                    }
                    placeholder="Mã giảm giá"
                    aria-label="Mã giảm giá"
                  />

                  <button
                    type="button"
                    className="btn small ink"
                    onClick={applyCoupon}
                  >
                    Áp dụng
                  </button>
                </div>

                {couponMsg && (
                  <p className={applied ? "coupon-ok" : "error"}>
                    {couponMsg}
                  </p>
                )}

                {vouchers.length > 0 ? (
                  <label className="voucher-pick">
                    Voucher của bạn

                    <select
                      value={voucherId}
                      onChange={(e) =>
                        setVoucherId(e.target.value)
                      }
                    >
                      <option value="">
                        — Không dùng voucher —
                      </option>

                      {vouchers.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          −{vnd(item.amount)} · đơn từ{" "}
                          {vnd(item.min_order)} · HSD{" "}
                          {new Date(
                            item.expires_at
                          ).toLocaleDateString("vi-VN")}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="voucher-hint">
                    Đổi điểm thưởng lấy voucher ở mục{" "}
                    <Link href="/account">Tài khoản</Link>.
                  </p>
                )}

                {voucher && !voucherOk && (
                  <p className="error">
                    Voucher này áp dụng cho đơn từ{" "}
                    {vnd(voucher.min_order)} (sau khi trừ mã giảm giá).
                  </p>
                )}
              </div>

              <div className="box">
                <div className="cap">Hình thức nhận hàng</div>

                <div
                  className="seg"
                  role="radiogroup"
                  aria-label="Hình thức nhận hàng"
                >
                  <button
                    type="button"
                    aria-pressed={!pickup}
                    onClick={() => setPickup(false)}
                  >
                    Giao tận nơi
                  </button>

                  <button
                    type="button"
                    aria-pressed={pickup}
                    onClick={() => setPickup(true)}
                  >
                    Tự đến lấy
                  </button>
                </div>
              </div>

              <div className="sumbox">
                <div className="cap">Tóm tắt đơn</div>

                <div>
                  <span>Tạm tính</span>
                  <span>{vnd(total)}</span>
                </div>

                {discount > 0 && (
                  <div className="coupon-ok">
                    <span>Giảm giá ({applied?.code})</span>
                    <span>−{vnd(discount)}</span>
                  </div>
                )}

                {voucherDiscount > 0 && (
                  <div className="coupon-ok">
                    <span>Voucher</span>
                    <span>−{vnd(voucherDiscount)}</span>
                  </div>
                )}

                <div>
                  <span>Phí giao hàng</span>
                  <span>
                    {ship ? vnd(ship) : "Miễn phí"}
                  </span>
                </div>

                <div className="grand">
                  <span>Tổng cộng</span>
                  <span>{vnd(grand)}</span>
                </div>

                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}

                <button
                  className="btn place"
                  type="submit"
                  form="checkout"
                  disabled={busy || !settings.is_open}
                >
                  {busy
                    ? "Đang xử lý…"
                    : `Đặt hàng · ${vnd(grand)}`}
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>

      {editing && (
        <ProductModal
          product={editing.product}
          replace={{
            key: editing.key,
            qty: editing.qty,
            picks: editing.picks,
            note: editing.note,
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <CartDrawer />
    </>
  );
}
