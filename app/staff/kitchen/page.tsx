
"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
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
  fulfillment?: string | null;
  order_items: OrderItem[];
};

type FilterType = "all" | "new" | "preparing" | "ready";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "28px 20px",
    color: "#292524",
  },

  container: {
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 28,
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
    fontSize: 13,
  },

  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    margin: "25px 0",
  },

  stat: {
    background: "#ffffff",
    border: "1px solid #e7e5e4",
    borderRadius: 14,
    padding: "18px 20px",
    minWidth: 0,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e7e5e4",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 3px 12px rgba(0,0,0,0.035)",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  button: {
    border: 0,
    borderRadius: 9,
    background: "#2563eb",
    color: "#ffffff",
    padding: "12px 15px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    width: "100%",
  },

  secondaryButton: {
    border: "1px solid #e7e5e4",
    borderRadius: 9,
    background: "#ffffff",
    color: "#44403c",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
};

const FILTERS: {
  id: FilterType;
  label: string;
  color: string;
}[] = [
  { id: "all", label: "Tất cả", color: "#ea580c" },
  { id: "new", label: "Đơn mới", color: "#ea580c" },
  { id: "preparing", label: "Đang chuẩn bị", color: "#2563eb" },
  { id: "ready", label: "Đã sẵn sàng", color: "#16a34a" },
];

export default function KitchenPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  // Tải danh sách đơn từ API.
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

  // Tự động tải lại sau mỗi 10 giây.
  useEffect(() => {
    loadOrders();

    const timer = window.setInterval(() => {
      loadOrders();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [loadOrders]);

  // Bếp thực hiện thao tác với đơn.
  const handleAction = async (
    orderId: string,
    action: "start" | "ready"
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

      setMessage(
        action === "start"
          ? "Đã tiếp nhận và bắt đầu chuẩn bị đơn."
          : "Đã hoàn tất chuẩn bị đơn hàng."
      );

      await loadOrders();
    } catch (err) {
      console.error(err);
      setError("Có lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setBusyId("");
    }
  };

  // Phân loại đơn hàng.
  const newOrders = orders.filter(
    (order) => ["new", "confirmed"].includes(order.status)
  );

  const preparingOrders = orders.filter(
    (order) => order.status === "preparing"
  );

  const readyOrders = orders.filter(
    (order) => order.status === "ready"
  );

  // Lọc theo trạng thái.
  const filteredOrders =
    filter === "new"
      ? newOrders
      : filter === "preparing"
        ? preparingOrders
        : filter === "ready"
          ? readyOrders
          : orders;

  // Đăng xuất.
  const logout = async () => {
    await supabaseAdmin.auth.signOut();
    router.push("/admin/login");
  };

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
              Khu vực tiếp nhận và chuẩn bị đơn hàng
            </div>
          </div>

          <button
            style={styles.secondaryButton}
            onClick={logout}
          >
            Đăng xuất
          </button>
        </header>

        {/* TIÊU ĐỀ */}
        <section>
          <h1 style={styles.title}>Quản lý đơn hàng tại Bếp</h1>

          <p style={styles.muted}>
            Theo dõi đơn mới và tiến độ chuẩn bị theo chi nhánh.
          </p>
        </section>

        {/* THỐNG KÊ */}
        <section style={styles.stats}>
          <div style={styles.stat}>
            <div
              style={{
                fontSize: 29,
                fontWeight: 800,
                color: "#ea580c",
              }}
            >
              {newOrders.length}
            </div>

            <div style={styles.muted}>Đơn mới</div>
          </div>

          <div style={styles.stat}>
            <div
              style={{
                fontSize: 29,
                fontWeight: 800,
                color: "#2563eb",
              }}
            >
              {preparingOrders.length}
            </div>

            <div style={styles.muted}>Đang chuẩn bị</div>
          </div>

          <div style={styles.stat}>
            <div
              style={{
                fontSize: 29,
                fontWeight: 800,
                color: "#16a34a",
              }}
            >
              {readyOrders.length}
            </div>

            <div style={styles.muted}>Đã sẵn sàng</div>
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
                  borderColor: active ? item.color : "#e7e5e4",
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
              {filter === "ready" ? "✅" : "🍔"}
            </div>

            <h3 style={{ margin: "0 0 8px" }}>
              {filter === "new"
                ? "Không có đơn mới"
                : filter === "preparing"
                  ? "Không có đơn đang chuẩn bị"
                  : filter === "ready"
                    ? "Chưa có đơn sẵn sàng"
                    : "Chưa có đơn hàng"}
            </h3>

            <p style={styles.muted}>
              Các đơn hàng mới sẽ tự động xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {filteredOrders.map((order) => {
              const isNew = ["new", "confirmed"].includes(order.status);
              const isPreparing = order.status === "preparing";
              const isReady = order.status === "ready";

              const statusInfo = isNew
                ? {
                    label: "Đơn mới",
                    color: "#c2410c",
                    background: "#ffedd5",
                  }
                : isPreparing
                  ? {
                      label: "Đang chuẩn bị",
                      color: "#1d4ed8",
                      background: "#dbeafe",
                    }
                  : {
                      label: "Đã sẵn sàng",
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
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontSize: 17 }}>
                      #{order.code}
                    </strong>

                    <span
                      style={{
                        background: statusInfo.background,
                        color: statusInfo.color,
                        borderRadius: 20,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div
                    style={{
                      ...styles.muted,
                      marginTop: 8,
                    }}
                  >
                    {new Date(order.created_at).toLocaleString("vi-VN")}
                  </div>

                  <hr
                    style={{
                      border: 0,
                      borderTop: "1px solid #e7e5e4",
                      margin: "15px 0",
                    }}
                  />

                  {/* THÔNG TIN KHÁCH */}
                  <strong style={{ fontSize: 15 }}>
                    {order.customer_name}
                  </strong>

                  <p style={{ margin: "8px 0", fontSize: 13 }}>
                    📞 {order.phone}
                  </p>

                  <p style={{ margin: "8px 0", fontSize: 13 }}>
                    📍 {order.address}
                  </p>

                  <p style={{ margin: "8px 0", fontSize: 13 }}>
                    {order.fulfillment === "pickup"
                      ? "🏪 Khách tự đến lấy"
                      : "🛵 Giao hàng"}
                  </p>

                  {/* DANH SÁCH MÓN */}
                  <div
                    style={{
                      background: "#fafaf9",
                      borderRadius: 11,
                      padding: 14,
                      marginTop: 12,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>
                      Danh sách món
                    </strong>

                    {(order.order_items || []).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          marginTop: 12,
                          paddingBottom: 10,
                          borderBottom: "1px dashed #e7e5e4",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            fontSize: 13,
                          }}
                        >
                          <strong>
                            {item.qty} × {item.name}
                          </strong>

                          <strong style={{ whiteSpace: "nowrap" }}>
                            {money(item.price * item.qty)}
                          </strong>
                        </div>

                        {item.options && (
                          <p
                            style={{
                              ...styles.muted,
                              margin: "5px 0 0",
                            }}
                          >
                            Tùy chọn: {item.options}
                          </p>
                        )}

                        {item.note && (
                          <p
                            style={{
                              color: "#b45309",
                              fontSize: 12,
                              margin: "5px 0 0",
                            }}
                          >
                            Ghi chú món: {item.note}
                          </p>
                        )}
                      </div>
                    ))}

                    {order.note && (
                      <div
                        style={{
                          background: "#fffbeb",
                          color: "#92400e",
                          padding: 10,
                          borderRadius: 8,
                          fontSize: 12,
                          marginTop: 12,
                        }}
                      >
                        📝 Ghi chú đơn: {order.note}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 14,
                        fontSize: 14,
                      }}
                    >
                      <strong>Tổng đơn</strong>

                      <strong style={{ color: "#ea580c" }}>
                        {money(order.total)}
                      </strong>
                    </div>
                  </div>

                  {/* NÚT THAO TÁC */}
                  <div style={{ marginTop: 16 }}>
                    {isNew && (
                      <button
                        style={{
                          ...styles.button,
                          opacity: busyId === order.id ? 0.6 : 1,
                        }}
                        disabled={busyId === order.id}
                        onClick={() =>
                          handleAction(order.id, "start")
                        }
                      >
                        {busyId === order.id
                          ? "Đang xử lý..."
                          : "▶ Bắt đầu chuẩn bị"}
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        style={{
                          ...styles.button,
                          background: "#16a34a",
                          opacity: busyId === order.id ? 0.6 : 1,
                        }}
                        disabled={busyId === order.id}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Bạn xác nhận đã chuẩn bị xong đơn hàng này?"
                            )
                          ) {
                            handleAction(order.id, "ready");
                          }
                        }}
                      >
                        {busyId === order.id
                          ? "Đang xử lý..."
                          : "✓ Hoàn tất chuẩn bị"}
                      </button>
                    )}

                    {isReady && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 9,
                          background: "#f0fdf4",
                          color: "#166534",
                          fontWeight: 700,
                          fontSize: 13,
                          textAlign: "center",
                        }}
                      >
                        ✓ Đã hoàn tất, chờ giao hàng
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
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
          PHỐ BURGER · Hệ thống quản lý Bếp
          <div style={{ marginTop: 5 }}>
            Danh sách đơn tự động cập nhật mỗi 10 giây
          </div>
        </footer>
      </div>
    </main>
  );
}
