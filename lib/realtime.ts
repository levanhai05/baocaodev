// Chỉ dùng trong API routes. Bắn tín hiệu realtime (Supabase Broadcast) tới bếp / shipper.
import { service } from "@/lib/server";

export type StaffAlert = { kind: "new_order" | "order_start" | "order_ready" | "delivering" | "delivered"; code: string; text: string };

export async function broadcast(channel: string, payload: StaffAlert) {
  try {
    const db = service();
    const ch = db.channel(channel);
    // Không subscribe: supabase-js tự gửi qua REST khi channel chưa kết nối.
    await ch.send({ type: "broadcast", event: "alert", payload });
    await db.removeChannel(ch);
  } catch (e) {
    console.error("broadcast error:", e); // không để lỗi realtime làm hỏng đơn hàng
  }
}

export const kitchenChannel = (storeId: number | string) => `staff-kitchen-${storeId}`;
export const adminChannel = "staff-admin";
export const notifyAdmin = (kind: StaffAlert["kind"], code: string, text: string) =>
  broadcast(adminChannel, { kind, code, text });

export const shipperChannel = (userId: string) => `staff-shipper-${userId}`;