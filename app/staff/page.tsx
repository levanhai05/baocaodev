
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { PAY, PAY_STATUS, vnd, type Order } from "@/lib/types";

type Store = {
  id: number;
  name: string;
};

type Tab = "kitchen" | "shipper" | "history";

const STATUS_LABEL: Record<string, string> = {
  new: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Đã sẵn sàng",
  delivering: "Đang giao",
  done: "Đã giao xong",
  cancelled: "Đã huỷ",
};

const KITCHEN_STATUSES = ["new", "confirmed", "preparing", "ready"];
const SHIPPER_STATUSES = ["ready", "delivering"];
const HISTORY_STATUSES = ["done", "cancelled"];

const money = (value: number | null | undefined) => vnd(value ?? 0);

const dateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const timeAgo = (value: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  );

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  return `${Math.floor(hours / 24)} ngày trước`;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("all");
  const [tab, setTab] = useState<Tab>("kitchen");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    const [orderResult, storeResult] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("stores").select("id,name").order("id"),
    ]);

    if (orderResult.error) {
      setError(orderResult.error.message);
    } else {
      setOrders((orderResult.data ?? []) as Order[]);
      setError("");
    }

    if (!storeResult.error) {
      setStores((storeResult.data ?? []) as Store[]);
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load(true);

    const timer = setInterval(() => load(), 15000);

    const channel = supabase
      .channel("admin-order-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          setTimeout(() => load(), 1000);
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchStore =
        storeId === "all" || String((order as any).store_id) === storeId;

      const keyword = search.trim().toLowerCase();
      const matchSearch =
        !keyword ||
        order.code?.toLowerCase().includes(keyword) ||
        order.customer_name?.toLowerCase().includes(keyword) ||
        order.phone?.toLowerCase().includes(keyword);

      return matchStore && matchSearch;
    });
  }, [orders, storeId, search]);

  const todayOrders = filteredOrders.filter((order) => {
    const date = new Date(order.created_at);
    const now = new Date();

    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear() &&
      order.status !== "cancelled"
    );
  });

  const activeOrders = filteredOrders.filter((order) =>
    [...KITCHEN_STATUSES, "delivering"].includes(order.status)
  );

  const kitchenOrders = filteredOrders.filter((order) =>
    KITCHEN_STATUSES.includes(order.status)
  );

  const shipperOrders = filteredOrders.filter((order) =>
    SHIPPER_STATUSES.includes(order.status)
  );

  const todayRevenue = todayOrders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + order.total, 0);

  const visibleOrders = useMemo(() => {
    if (tab === "kitchen") {
      return filteredOrders.filter((order) =>
        KITCHEN_STATUSES.includes(order.status)
      );
    }

    if (tab === "shipper") {
      return filteredOrders.filter((order) =>
        SHIPPER_STATUSES.includes(order.status)
      );
    }

    return filteredOrders.filter((order) =>
      HISTORY_STATUSES.includes(order.status)
    );
  }, [filteredOrders, tab]);

  async function updatePayment(orderId: string, paymentStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", orderId);

    if (error) {
      alert("Không cập nhật được thanh toán: " + error.message);
      return;
    }

    await load();
  }

  async function cancelOrder(order: Order) {
    if (order.status === "done" || order.status === "cancelled") return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn huỷ đơn #${order.code} không?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);

    if (error) {
      alert("Không thể huỷ đơn: " + error.message);
      return;
    }

    await load();
  }

  function getStoreName(id: number) {
    return stores.find((store) => store.id === id)?.name ?? `Chi nhánh ${id}`;
  }

  function OrderCard({ order }: { order: Order }) {
    const store = getStoreName((order as any).store_id);
    const items = order.order_items ?? [];

    return (
      <article className="order-card">
        <div className="order-card-top">
          <div>
            <span className="order-code">#{order.code}</span>
            <span className="order-time">{timeAgo(order.created_at)}</span>
          </div>
          <span className={`status-pill status-${order.status}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <div className="customer-info">
          <strong>{order.customer_name}</strong>
          <a href={`tel:${order.phone}`}>{order.phone}</a>
        </div>

        <div className="order-address">
          <span>{order.fulfillment === "pickup" ? "🏪" : "📍"}</span>
          <span>
            {order.fulfillment === "pickup"
              ? "Khách tự đến lấy"
              : order.address || "Chưa có địa chỉ"}
          </span>
        </div>

        {order.scheduled_for && (
          <div className="order-extra">🕒 Hẹn: {order.scheduled_for}</div>
        )}

        {order.note && (
          <div className="order-note">Ghi chú: {order.note}</div>
        )}

        <div className="order-items">
          {items.map((item) => (
            <div className="order-item" key={item.id}>
              <span>
                {item.name} <b>× {item.qty}</b>
                {item.options ? ` · ${item.options}` : ""}
              </span>
              <span>{money(item.price * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="order-store">🏬 {store}</div>

        {order.assigned_shipper_id && (
          <div className="order-store">🛵 Đã phân công shipper</div>
        )}

        <div className="order-total">
          <span>Tổng thanh toán</span>
          <strong>{money(order.total)}</strong>
        </div>

        <div className="order-payment">
          <span>{PAY[order.payment_method] ?? order.payment_method}</span>
          <select
            aria-label="Trạng thái thanh toán"
            value={order.payment_status ?? "unpaid"}
            onChange={(event) =>
              updatePayment(order.id, event.target.value)
            }
          >
            {Object.entries(PAY_STATUS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {order.status !== "done" && order.status !== "cancelled" && (
          <button
            className="cancel-order"
            onClick={() => cancelOrder(order)}
          >
            Huỷ đơn hàng
          </button>
        )}
      </article>
    );
  }

  function BoardColumn({
    status,
    title,
    color,
  }: {
    status: string;
    title: string;
    color: string;
  }) {
    const list = visibleOrders.filter((order) => order.status === status);

    return (
      <section className={`board-column ${color}`}>
        <div className="column-heading">
          <div>
            <span className="column-dot" />
            <strong>{title}</strong>
          </div>
          <span className="column-count">{list.length}</span>
        </div>

        <div className="column-content">
          {list.length === 0 ? (
            <div className="empty-column">
              <span>✓</span>
              <p>Chưa có đơn hàng</p>
            </div>
          ) : (
            list.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="admin-orders">
      <style>{`
        .admin-orders {
          --orange: #f36b21;
          --ink: #252525;
          --muted: #81858c;
          --line: #eceef1;
          color: var(--ink);
          width: 100%;
          min-height: 100vh;
          padding: 26px;
          background: #f7f8fa;
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
        }
        .admin-orders * { box-sizing: border-box; }
        .page-heading {
          display:flex; align-items:center; justify-content:space-between;
          gap:18px; flex-wrap:wrap; margin-bottom:22px;
        }
        .heading-left { display:flex; align-items:center; gap:14px; }
        .heading-icon {
          width:46px;height:46px;border-radius:14px;
          display:grid;place-items:center;background:#fff0e7;
          color:var(--orange);font-size:24px;
        }
        .page-heading h1 {font-size:24px;margin:0 0 5px;font-weight:800;}
        .page-heading p {margin:0;color:var(--muted);font-size:13px;}
        .heading-actions {display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .store-select {
          min-width:220px;height:40px;padding:0 12px;border:1px solid var(--line);
          border-radius:10px;background:#fff;color:#333;font-size:13px;
        }
        .refresh-button {
          height:40px;padding:0 16px;border:1px solid var(--line);
          border-radius:10px;background:#fff;font-weight:700;cursor:pointer;
        }
        .refresh-button:hover {border-color:var(--orange);color:var(--orange);}
        .update-time {font-size:11px;color:var(--muted);}
        .stats-grid {
          display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
          gap:14px;margin-bottom:22px;
        }
        .stat-card {
          min-height:112px;padding:18px 20px;background:#fff;
          border:1px solid var(--line);border-radius:15px;
          display:flex;align-items:center;gap:14px;
          box-shadow:0 2px 8px rgba(20,30,50,.025);
        }
        .stat-icon {
          width:48px;height:48px;border-radius:14px;display:grid;
          place-items:center;font-size:23px;flex-shrink:0;
        }
        .stat-number {font-size:27px;font-weight:800;line-height:1.1;}
        .stat-label {font-size:12px;color:var(--muted);margin-top:6px;}
        .stat-orange .stat-icon {background:#fff0e7;color:#f36b21;}
        .stat-orange .stat-number {color:#e9651c;}
        .stat-blue .stat-icon {background:#eaf2ff;color:#3478e5;}
        .stat-blue .stat-number {color:#3478e5;}
        .stat-purple .stat-icon {background:#f1eaff;color:#8054dc;}
        .stat-purple .stat-number {color:#8054dc;}
        .stat-green .stat-icon {background:#e8f8ed;color:#20a45a;}
        .stat-green .stat-number {color:#20a45a;}
        .workspace {
          background:#fff;border:1px solid var(--line);border-radius:16px;
          padding:18px;margin-bottom:20px;
          box-shadow:0 2px 8px rgba(20,30,50,.025);
        }
        .workspace-top {
          display:flex;align-items:center;justify-content:space-between;
          gap:12px;flex-wrap:wrap;margin-bottom:16px;
        }
        .tabs {display:flex;gap:8px;flex-wrap:wrap;}
        .tab-button {
          border:1px solid var(--line);background:#fff;color:#555;
          border-radius:10px;padding:10px 16px;font-size:13px;
          font-weight:700;cursor:pointer;display:flex;align-items:center;gap:9px;
        }
        .tab-button.active {background:var(--orange);border-color:var(--orange);color:#fff;}
        .tab-count {
          min-width:21px;height:21px;padding:0 6px;border-radius:20px;
          display:grid;place-items:center;background:#f0f1f3;color:#444;font-size:11px;
        }
        .tab-button.active .tab-count {background:#fff;color:var(--orange);}
        .search-input {
          height:38px;width:230px;max-width:100%;border:1px solid var(--line);
          border-radius:9px;padding:0 12px;outline:none;font-size:13px;
        }
        .search-input:focus {border-color:var(--orange);}
        .board-title {
          display:flex;align-items:center;justify-content:space-between;
          margin:4px 0 14px;
        }
        .board-title h2 {font-size:16px;margin:0;font-weight:800;}
        .board-title span {font-size:12px;color:var(--muted);}
        .board-grid {
          display:grid;grid-template-columns:repeat(4,minmax(245px,1fr));
          gap:12px;align-items:start;
        }
        .board-grid.shipper-grid {grid-template-columns:repeat(2,minmax(245px,1fr));}
        .board-column {
          border:1px solid var(--line);border-radius:13px;
          overflow:hidden;background:#fafbfc;min-width:0;
        }
        .column-heading {
          min-height:48px;padding:11px 13px;display:flex;
          justify-content:space-between;align-items:center;
          background:#f3f4f6;
        }
        .column-heading > div {display:flex;align-items:center;gap:9px;}
        .column-heading strong {font-size:12px;}
        .column-dot {width:9px;height:9px;border-radius:50%;background:#999;}
        .column-count {
          min-width:22px;height:22px;padding:0 6px;border-radius:20px;
          display:grid;place-items:center;background:#e8e9ec;font-size:11px;font-weight:800;
        }
        .column-content {padding:9px;min-height:145px;}
        .col-new .column-heading {background:#fff1e8;}
        .col-new .column-dot,.col-new .column-count {background:#f36b21;color:#fff;}
        .col-confirmed .column-heading {background:#edf3ff;}
        .col-confirmed .column-dot,.col-confirmed .column-count {background:#3978e5;color:#fff;}
        .col-preparing .column-heading {background:#eaf8ef;}
        .col-preparing .column-dot,.col-preparing .column-count {background:#20a45a;color:#fff;}
        .col-ready .column-heading {background:#f2ecff;}
        .col-ready .column-dot,.col-ready .column-count {background:#8054dc;color:#fff;}
        .col-delivering .column-heading {background:#fff5e5;}
        .col-delivering .column-dot,.col-delivering .column-count {background:#e99a20;color:#fff;}
        .order-card {
          background:#fff;border:1px solid #e9ebef;border-radius:11px;
          padding:13px;margin-bottom:9px;
          box-shadow:0 2px 6px rgba(20,30,50,.035);
        }
        .order-card-top {display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:11px;}
        .order-code {font-size:13px;font-weight:800;}
        .order-time {font-size:10px;color:var(--muted);margin-left:8px;}
        .status-pill {
          display:inline-flex;align-items:center;padding:5px 8px;
          border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;
        }
        .status-new {background:#fff0e7;color:#df651e;}
        .status-confirmed {background:#eaf2ff;color:#3478e5;}
        .status-preparing {background:#e8f8ed;color:#1c9950;}
        .status-ready {background:#f0eaff;color:#8054dc;}
        .status-delivering {background:#fff4df;color:#bd7912;}
        .status-done {background:#e5f7ec;color:#16884a;}
        .status-cancelled {background:#ffe9eb;color:#d33d50;}
        .customer-info {display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;}
        .customer-info a {color:#657184;text-decoration:underline;}
        .order-address {display:flex;gap:7px;margin-top:10px;font-size:11px;color:#657184;line-height:1.5;}
        .order-extra {font-size:11px;color:#777;margin-top:7px;}
        .order-note {margin-top:8px;padding:8px;background:#fff8ed;color:#94601e;border-radius:7px;font-size:11px;}
        .order-items {border-top:1px solid #f0f0f0;margin-top:10px;padding-top:8px;}
        .order-item {display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:11px;}
        .order-item span:last-child {white-space:nowrap;color:#666;}
        .order-store {font-size:10px;color:#7b8491;margin-top:8px;}
        .order-total {display:flex;justify-content:space-between;align-items:center;border-top:1px solid #eee;margin-top:10px;padding-top:10px;font-size:11px;color:#777;}
        .order-total strong {font-size:15px;color:var(--orange);}
        .order-payment {display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:9px;font-size:10px;color:#777;}
        .order-payment select {
          max-width:125px;border:1px solid var(--line);border-radius:7px;
          padding:6px;background:#fff;font-size:10px;
        }
        .cancel-order {
          margin-top:10px;width:100%;padding:7px;border:1px solid #f3d6d8;
          color:#cf4d58;background:#fff;border-radius:7px;font-size:11px;
          cursor:pointer;
        }
        .cancel-order:hover {background:#fff1f2;}
        .empty-column {
          min-height:125px;display:flex;flex-direction:column;
          align-items:center;justify-content:center;color:#a1a5ad;
        }
        .empty-column span {font-size:22px;color:#c5c9d0;}
        .empty-column p {font-size:11px;margin:7px 0 0;}
        .history-panel {
          background:#fff;border:1px solid var(--line);border-radius:16px;
          padding:18px;box-shadow:0 2px 8px rgba(20,30,50,.025);
        }
        .history-heading {display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .history-heading h2 {font-size:16px;margin:0;}
        .history-heading span {font-size:12px;color:var(--muted);}
        .table-wrap {overflow-x:auto;}
        .history-table {width:100%;border-collapse:collapse;min-width:760px;}
        .history-table th {
          text-align:left;padding:12px 10px;background:#f7f8fa;
          color:#737b87;font-size:11px;font-weight:700;
        }
        .history-table td {padding:12px 10px;border-bottom:1px solid #f0f1f3;font-size:12px;}
        .history-table tr:last-child td {border-bottom:0;}
        .history-table .amount {font-weight:800;color:#e9651c;white-space:nowrap;}
        .history-items {max-width:260px;color:#657184;line-height:1.6;}
        .error-box {padding:12px;background:#fff0f0;color:#c33;border-radius:9px;margin-bottom:14px;font-size:13px;}
        .loading-box,.empty-history {padding:35px;text-align:center;color:#8b919b;font-size:13px;}
        .page-footer {text-align:center;padding:16px;color:#a0a4ab;font-size:10px;}
        @media(max-width:1100px) {
          .stats-grid {grid-template-columns:repeat(2,minmax(0,1fr));}
          .board-grid {grid-template-columns:repeat(2,minmax(240px,1fr));}
        }
        @media(max-width:650px) {
          .admin-orders {padding:14px;}
          .stats-grid {grid-template-columns:1fr 1fr;gap:8px;}
          .stat-card {padding:12px;min-height:88px;gap:9px;}
          .stat-icon {width:36px;height:36px;font-size:18px;}
          .stat-number {font-size:21px;}
          .stat-label {font-size:10px;}
          .board-grid,.board-grid.shipper-grid {grid-template-columns:1fr;}
          .workspace,.history-panel {padding:12px;}
          .search-input {width:100%;}
          .page-heading h1 {font-size:20px;}
        }
      `}</style>

      <header className="page-heading">
        <div className="heading-left">
          <div className="heading-icon">▥</div>
          <div>
            <h1>Điều phối đơn hàng</h1>
            <p>Quản lý hoạt động Bếp và Shipper của Phố Burger</p>
          </div>
        </div>

        <div className="heading-actions">
          <select
            className="store-select"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          >
            <option value="all">Tất cả chi nhánh</option>
            {stores.map((store) => (
              <option key={store.id} value={String(store.id)}>
                {store.name}
              </option>
            ))}
          </select>

          <button
            className="refresh-button"
            onClick={() => load(true)}
            disabled={loading}
          >
            ↻ Làm mới
          </button>

          <span className="update-time">
            ● Cập nhật lúc {lastUpdated.toLocaleTimeString("vi-VN")}
          </span>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      <section className="stats-grid">
        <div className="stat-card stat-orange">
          <div className="stat-icon">▣</div>
          <div>
            <div className="stat-number">{activeOrders.length}</div>
            <div className="stat-label">Đơn đang xử lý</div>
          </div>
        </div>

        <div className="stat-card stat-blue">
          <div className="stat-icon">♨</div>
          <div>
            <div className="stat-number">{kitchenOrders.length}</div>
            <div className="stat-label">Đơn tại bếp</div>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon">🛵</div>
          <div>
            <div className="stat-number">
              {filteredOrders.filter((order) => order.status === "delivering").length}
            </div>
            <div className="stat-label">Đơn đang giao</div>
          </div>
        </div>

        <div className="stat-card stat-green">
          <div className="stat-icon">₫</div>
          <div>
            <div className="stat-number">{money(todayRevenue)}</div>
            <div className="stat-label">Doanh thu đã thanh toán hôm nay</div>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-top">
          <div className="tabs">
            <button
              className={`tab-button ${tab === "kitchen" ? "active" : ""}`}
              onClick={() => setTab("kitchen")}
            >
              ♨ Khu vực Bếp <span className="tab-count">{kitchenOrders.length}</span>
            </button>

            <button
              className={`tab-button ${tab === "shipper" ? "active" : ""}`}
              onClick={() => setTab("shipper")}
            >
              🛵 Khu vực Shipper <span className="tab-count">{shipperOrders.length}</span>
            </button>

            <button
              className={`tab-button ${tab === "history" ? "active" : ""}`}
              onClick={() => setTab("history")}
            >
              ◷ Lịch sử
            </button>
          </div>

          <input
            className="search-input"
            placeholder="Tìm mã đơn, tên hoặc số điện thoại..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {tab !== "history" ? (
          <>
            <div className="board-title">
              <h2>{tab === "kitchen" ? "♨ Theo dõi khu vực Bếp" : "🛵 Theo dõi khu vực Shipper"}</h2>
              <span>{visibleOrders.length} đơn hàng</span>
            </div>

            {loading ? (
              <div className="loading-box">Đang tải đơn hàng...</div>
            ) : tab === "kitchen" ? (
              <div className="board-grid">
                <BoardColumn status="new" title="Chờ xác nhận" color="col-new" />
                <BoardColumn status="confirmed" title="Đã xác nhận" color="col-confirmed" />
                <BoardColumn status="preparing" title="Đang chuẩn bị" color="col-preparing" />
                <BoardColumn status="ready" title="Đã sẵn sàng" color="col-ready" />
              </div>
            ) : (
              <div className="board-grid shipper-grid">
                <BoardColumn status="ready" title="Chờ nhận giao" color="col-ready" />
                <BoardColumn status="delivering" title="Đang giao hàng" color="col-delivering" />
              </div>
            )}
          </>
        ) : (
          <div className="history-content">
            <div className="history-heading">
              <h2>◷ Lịch sử đơn hàng</h2>
              <span>{visibleOrders.length} đơn đã kết thúc</span>
            </div>

            {loading ? (
              <div className="loading-box">Đang tải lịch sử...</div>
            ) : visibleOrders.length === 0 ? (
              <div className="empty-history">Chưa có đơn hàng trong lịch sử.</div>
            ) : (
              <div className="table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Món ăn</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id}>
                        <td><b>#{order.code}</b></td>
                        <td>
                          <b>{order.customer_name}</b>
                          <br />
                          <span style={{ color: "#81858c" }}>{order.phone}</span>
                        </td>
                        <td className="history-items">
                          {(order.order_items ?? [])
                            .map((item) => `${item.name} × ${item.qty}`)
                            .join(", ")}
                        </td>
                        <td className="amount">{money(order.total)}</td>
                        <td>
                          <span className={`status-pill status-${order.status}`}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </td>
                        <td>{dateTime(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="page-footer">
        PHỐ BURGER · TRUNG TÂM ĐIỀU PHỐI ĐƠN HÀNG · Tự động cập nhật mỗi 15 giây
      </footer>
    </main>
  );
}
