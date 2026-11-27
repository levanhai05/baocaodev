"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabase";

type OrderItem = {
  id: number;
  name: string;
  price: number;
  qty: number;
  options?: string | null;
  note?: string | null;
};

type Order = {
  id: string;
  code: string;
  customer_name: string;
  phone: string;
  address: string;
  note: string | null;
  payment_method: string;
  payment_status: string;
  shipping_fee: number;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

type FilterType = "all" | "ready" | "delivering" | "done";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#fffaf4",
    padding: "28px 20px",
    color: "#292524",
  },

  container: {
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 30,
  },

  brand: {
    fontSize: 21,
    fontWeight: 800,
    color: "#ea580c",
  },

  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: "0 0 8px",
  },

  muted: {
    color: "#78716c",
    fontSize: 14,
  },

  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
    margin: "26px 0",
  },

  stat: {
    background: "#ffffff",
    border: "1px solid #f1e5d8",
    borderRadius: 14,
    padding: "18px 20px",
    minWidth: 0,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #f1e5d8",
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
    boxShadow: "0 3px 12px rgba(80,50,20,0.04)",
  },

  button: {
    border: 0,
    borderRadius: 10,
    background: "#ea580c",
    color: "#ffffff",
    padding: "13px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    width: "100%",
  },

  secondaryButton: {
    border: "1px solid #e7d9ca",
    borderRadius: 10,
    background: "#ffffff",
    color: "#44403c",
    padding: "11px 15px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
};

const FILTERS: {
  id: FilterType;
  label: string;
  color: string;
  background: string;
}[] = [
  {
    id: "all",
    label: "Tất cả",
    color: "#ea580c",
    background: "#fff7ed",
  },
  {
    id: "ready",
    label: "Chờ giao",
    color: "#d97706",
    background: "#fffbeb",
  },
  {
    id: "delivering",
    label: "Đang giao",
    color: "#2563eb",
    background: "#eff6ff",
  },
  {
    id: "done",
    label: "Đã giao xong",
    color: "#16a34a",
    background: "#f0fdf4",
  },
];

export default function ShipperPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  // Tải danh sách đơn hàng.
  const loadOrders = useCallback(async () => {
    try {
      const { data } = await supabaseAdmin.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/staff/orders", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Không thể tải danh sách đơn hàng.");
        setLoading(false);
        return;
      }

      setOrders(result.orders || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Tự động cập nhật mỗi 10 giây.
  useEffect(() => {
    loadOrders();

    const timer = window.setInterval(() => {
      loadOrders();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [loadOrders]);

  // Thực hiện thao tác với đơn hàng.
  const handleAction = async (
    orderId: string,
    action: "start_delivery" | "delivered"
  ) => {
    setBusyId(orderId);
    setError("");
    setMessage("");

    try {
      const { data } = await supabaseAdmin.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setError("Phiên đăng nhập đã hết hạn.");
        return;
      }

      const response = await fetch("/api/staff/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Thao tác không thành công.");
        return;
      }

      setMessage(result.message || "Cập nhật đơn thành công.");

      await loadOrders();
    } catch (err) {
      console.error(err);
      setError("Có lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setBusyId("");
    }
  };

  // Thống kê đơn hàng.
  const readyOrders = orders.filter(
    (order) => order.status === "ready"
  );

  const deliveringOrders = orders.filter(
    (order) => order.status === "delivering"
  );

  const doneOrders = orders.filter(
    (order) => order.status === "done"
  );

  // Lọc danh sách đơn.
  const filteredOrders =
    filter === "ready"
      ? readyOrders
      : filter === "delivering"
        ? deliveringOrders
        : filter === "done"
          ? doneOrders
          : orders;

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.brand}>
            🍔 PHỐ BURGER
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#78716c",
                marginTop: 5,
              }}
            >
              Khu vực nhân viên giao hàng
            </div>
          </div>
        </header>

        {/* TIÊU ĐỀ */}
        <section>
          <h1 style={styles.title}>Đơn hàng của tôi</h1>

          <p style={styles.muted}>
            Theo dõi và quản lý các đơn hàng được phân công cho bạn.
          </p>
        </section>

        {/* THỐNG KÊ */}
        <section style={styles.stats}>
          <div style={styles.stat}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {orders.length}
            </div>

            <div style={styles.muted}>Tất cả đơn</div>
          </div>

          <div style={styles.stat}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#d97706",
              }}
            >
              {readyOrders.length}
            </div>

            <div style={styles.muted}>Chờ giao</div>
          </div>

          <div style={styles.stat}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#2563eb",
              }}
            >
              {deliveringOrders.length}
            </div>

            <div style={styles.muted}>Đang giao</div>
          </div>

          <div style={styles.stat}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#16a34a",
              }}
            >
              {doneOrders.length}
            </div>

            <div style={styles.muted}>Đã giao xong</div>
          </div>
        </section>

        {/* BỘ LỌC */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
            width: "100%",
            marginBottom: 18,
          }}
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                style={{
                  ...styles.secondaryButton,
                  width: "100%",
                  minWidth: 0,
                  padding: "13px 5px",
                  fontSize: 13,
                  whiteSpace: "normal",
                  background: active ? item.color : "#ffffff",
                  color: active ? "#ffffff" : "#44403c",
                  borderColor: active ? item.color : "#e7d9ca",
                  boxShadow: active
                    ? "0 3px 8px rgba(0,0,0,0.08)"
                    : "none",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </section>

        {/* LÀM MỚI */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 18,
          }}
        >
          <button
            style={styles.secondaryButton}
            onClick={loadOrders}
          >
            ↻ Làm mới danh sách
          </button>
        </div>

        {/* THÔNG BÁO */}
        {message && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#dcfce7",
              color: "#166534",
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            ✓ {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#fee2e2",
              color: "#991b1b",
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* DANH SÁCH ĐƠN */}
        {loading ? (
          <div style={{ ...styles.card, textAlign: "center" }}>
            Đang tải danh sách đơn hàng...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              ...styles.card,
              textAlign: "center",
              padding: "55px 20px",
            }}
          >
            <div style={{ fontSize: 45, marginBottom: 12 }}>
              {filter === "done" ? "✅" : "🛵"}
            </div>

            <h3 style={{ margin: "0 0 8px" }}>
              {filter === "done"
                ? "Chưa có đơn giao thành công"
                : filter === "ready"
                  ? "Chưa có đơn chờ giao"
                  : filter === "delivering"
                    ? "Không có đơn đang giao"
                    : "Chưa có đơn hàng"}
            </h3>

            <p style={styles.muted}>
              {filter === "done"
                ? "Các đơn giao thành công sẽ được lưu tại đây."
                : "Khi Bếp hoàn tất đơn và phân công cho bạn, đơn sẽ xuất hiện ở đây."}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusInfo =
              order.status === "ready"
                ? {
                    label: "Chờ giao",
                    color: "#92400e",
                    background: "#fef3c7",
                  }
                : order.status === "delivering"
                  ? {
                      label: "Đang giao",
                      color: "#1d4ed8",
                      background: "#dbeafe",
                    }
                  : {
                      label: "Đã giao thành công",
                      color: "#166534",
                      background: "#dcfce7",
                    };

            return (
              <article key={order.id} style={styles.card}>

                {/* MÃ ĐƠN VÀ TRẠNG THÁI */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 18 }}>
                      Đơn #{order.code}
                    </strong>

                    <div
                      style={{
                        ...styles.muted,
                        marginTop: 5,
                      }}
                    >
                      {new Date(order.created_at).toLocaleString("vi-VN")}
                    </div>
                  </div>

                  <span
                    style={{
                      background: statusInfo.background,
                      color: statusInfo.color,
                      borderRadius: 20,
                      padding: "7px 13px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                <hr
                  style={{
                    border: 0,
                    borderTop: "1px solid #f1e5d8",
                    margin: "17px 0",
                  }}
                />

                {/* THÔNG TIN KHÁCH */}
                <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>
                  👤 {order.customer_name}
                </h3>

                <p style={{ margin: "7px 0", fontSize: 14 }}>
                  📞{" "}
                  <a
                    href={`tel:${order.phone}`}
                    style={{ color: "#ea580c", textDecoration: "none" }}
                  >
                    {order.phone}
                  </a>
                </p>

                <p style={{ margin: "7px 0", fontSize: 14 }}>
                  📍 {order.address}
                </p>

                {order.note && (
                  <p
                    style={{
                      color: "#b45309",
                      margin: "10px 0",
                      fontSize: 14,
                    }}
                  >
                    📝 Ghi chú: {order.note}
                  </p>
                )}

                {/* CHI TIẾT MÓN */}
                <div
                  style={{
                    background: "#fffaf4",
                    borderRadius: 12,
                    padding: 16,
                    marginTop: 17,
                  }}
                >
                  <strong>Danh sách món</strong>

                  {(order.order_items || []).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginTop: 12,
                        fontSize: 14,
                      }}
                    >
                      <div>
                        <div>
                          {item.name} × {item.qty}
                        </div>

                        {item.options && (
                          <div style={{ ...styles.muted, marginTop: 4 }}>
                            Tùy chọn: {item.options}
                          </div>
                        )}

                        {item.note && (
                          <div
                            style={{
                              color: "#b45309",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Ghi chú món: {item.note}
                          </div>
                        )}
                      </div>

                      <strong style={{ whiteSpace: "nowrap" }}>
                        {money(item.price * item.qty)}
                      </strong>
                    </div>
                  ))}

                  <hr
                    style={{
                      border: 0,
                      borderTop: "1px solid #eadfd3",
                      margin: "15px 0",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                    }}
                  >
                    <span>Phí giao hàng</span>
                    <strong>{money(order.shipping_fee)}</strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 12,
                      fontSize: 17,
                    }}
                  >
                    <strong>Tổng đơn</strong>

                    <strong style={{ color: "#ea580c" }}>
                      {money(order.total)}
                    </strong>
                  </div>
                </div>

                {/* NÚT THAO TÁC */}
                <div style={{ marginTop: 17 }}>

                  {order.status === "ready" && (
                    <button
                      style={{
                        ...styles.button,
                        opacity: busyId === order.id ? 0.6 : 1,
                      }}
                      disabled={busyId === order.id}
                      onClick={() =>
                        handleAction(order.id, "start_delivery")
                      }
                    >
                      {busyId === order.id
                        ? "Đang xử lý..."
                        : "🛵 Bắt đầu giao hàng"}
                    </button>
                  )}

                  {order.status === "delivering" && (
                    <button
                      style={{
                        ...styles.button,
                        background: "#15803d",
                        opacity: busyId === order.id ? 0.6 : 1,
                      }}
                      disabled={busyId === order.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Bạn xác nhận đơn hàng đã được giao thành công?"
                          )
                        ) {
                          handleAction(order.id, "delivered");
                        }
                      }}
                    >
                      {busyId === order.id
                        ? "Đang xử lý..."
                        : "✓ Xác nhận đã giao thành công"}
                    </button>
                  )}

                  {order.status === "done" && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "#f0fdf4",
                        color: "#166534",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      ✓ Đơn hàng đã giao thành công
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}

        {/* FOOTER */}
        <footer
          style={{
            textAlign: "center",
            color: "#a8a29e",
            fontSize: 12,
            marginTop: 30,
            paddingBottom: 20,
          }}
        >
          PHỐ BURGER · Hệ thống quản lý giao hàng
          <div style={{ marginTop: 5 }}>
            Danh sách đơn tự động cập nhật mỗi 10 giây
          </div>
        </footer>
      </div>
    </main>
  );
}