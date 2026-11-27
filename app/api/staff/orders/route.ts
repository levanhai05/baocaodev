import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/server";
import { broadcast, notifyAdmin, shipperChannel } from "@/lib/realtime";

// GET: Lấy đơn hàng theo vai trò và chi nhánh.
export async function GET(req: Request) {
  const auth = await requireStaff(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Bạn không có quyền truy cập." },
      { status: 401 }
    );
  }

  const { db, staff } = auth;

  let query = db
    .from("orders")
    .select("*, order_items(*)")
    .eq("store_id", staff.store_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (staff.role === "kitchen") {
    // Bếp xem đơn đang chờ, đang chuẩn bị và đã sẵn sàng.
    query = query.in("status", [
      "new",
      "confirmed",
      "preparing",
      "ready",
    ]);
  } else if (staff.role === "shipper") {
    // Shipper chỉ xem đơn được phân công cho chính mình.
    // Bao gồm cả đơn đã giao thành công để xem lịch sử.
    query = query
      .eq("assigned_shipper_id", staff.user_id)
      .in("status", ["ready", "delivering", "done"]);
  } else {
    return NextResponse.json(
      { error: "Vai trò nhân viên không hợp lệ." },
      { status: 403 }
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("GET staff orders error:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách đơn hàng." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    orders: data ?? [],
  });
}

// PATCH: Xử lý các thao tác của Bếp và Shipper.
export async function PATCH(req: Request) {
  const auth = await requireStaff(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này." },
      { status: 401 }
    );
  }

  const { db, user, staff } = auth;

  let body: {
    order_id?: string;
    action?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 }
    );
  }

  const { order_id, action } = body;

  if (
    !order_id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      order_id
    )
  ) {
    return NextResponse.json(
      { error: "Mã đơn hàng không hợp lệ." },
      { status: 400 }
    );
  }

  // BẾP: Bắt đầu chuẩn bị đơn.
  if (action === "start" && staff.role === "kitchen") {
    const { data, error } = await db
      .from("orders")
      .update({
        status: "preparing",
      })
      .eq("id", order_id)
      .eq("store_id", staff.store_id)
      .in("status", ["new", "confirmed"])
      .select("id, code")
      .maybeSingle();

    if (error) {
      console.error("Kitchen start error:", error);

      return NextResponse.json(
        { error: "Không thể bắt đầu chuẩn bị đơn." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Đơn không tồn tại hoặc đã được xử lý." },
        { status: 409 }
      );
    }

    await notifyAdmin("order_start", data.code, `Bếp (${staff.name ?? (staff.role === "kitchen" ? "Bếp" : "Shipper")}) đã nhận đơn và bắt đầu chuẩn bị`);

    return NextResponse.json({
      success: true,
      message: "Đã tiếp nhận và bắt đầu chuẩn bị đơn.",
    });
  }

  // BẾP: Hoàn tất chuẩn bị và tự động phân Shipper.
  if (action === "ready" && staff.role === "kitchen") {
    const { data, error } = await db.rpc(
      "mark_order_ready_and_assign_shipper",
      {
        p_order_id: order_id,
        p_kitchen_id: user.id,
        p_store_id: staff.store_id,
      }
    );

    if (error) {
      console.error("Kitchen ready error:", error);

      return NextResponse.json(
        { error: "Không thể hoàn tất đơn. Đơn có thể đã được xử lý." },
        { status: 409 }
      );
    }

    // Thông báo realtime cho Shipper vừa được phân công + Admin
    const { data: o } = await db.from("orders").select("code").eq("id", order_id).maybeSingle();
    if (data?.assigned_shipper_id) {
      await broadcast(shipperChannel(data.assigned_shipper_id), {
        kind: "order_ready", code: o?.code ?? "", text: "Bếp đã làm xong món, mời bạn đến lấy hàng giao!",
      });
    }
    await notifyAdmin("order_ready", o?.code ?? "", `Bếp (${staff.name ?? (staff.role === "kitchen" ? "Bếp" : "Shipper")}) đã làm xong món. ${data?.message ?? ""}`);

    return NextResponse.json(data);
  }

  // SHIPPER: Bắt đầu giao đơn đã được phân công.
  if (action === "start_delivery" && staff.role === "shipper") {
    const { data, error } = await db
      .from("orders")
      .update({
        status: "delivering",
      })
      .eq("id", order_id)
      .eq("store_id", staff.store_id)
      .eq("assigned_shipper_id", user.id)
      .eq("status", "ready")
      .select("id, code")
      .maybeSingle();

    if (error) {
      console.error("Shipper start delivery error:", error);

      return NextResponse.json(
        { error: "Không thể bắt đầu giao đơn." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Đơn không tồn tại, chưa sẵn sàng hoặc không thuộc bạn." },
        { status: 409 }
      );
    }

    await notifyAdmin("delivering", data.code, `Shipper (${staff.name ?? (staff.role === "kitchen" ? "Bếp" : "Shipper")}) bắt đầu giao đơn`);

    return NextResponse.json({
      success: true,
      message: "Đã bắt đầu giao hàng.",
    });
  }

  // SHIPPER: Xác nhận giao hàng thành công.
  if (action === "delivered" && staff.role === "shipper") {
    const { data, error } = await db
      .from("orders")
      .update({
        status: "done",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .eq("store_id", staff.store_id)
      .eq("assigned_shipper_id", user.id)
      .eq("status", "delivering")
      .select("id, code")
      .maybeSingle();

    if (error) {
      console.error("Shipper delivered error:", error);

      return NextResponse.json(
        { error: "Không thể xác nhận giao hàng." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Đơn không tồn tại hoặc không thuộc bạn." },
        { status: 409 }
      );
    }

    await notifyAdmin("delivered", data.code, `Shipper (${staff.name ?? (staff.role === "kitchen" ? "Bếp" : "Shipper")}) đã giao thành công`);

    return NextResponse.json({
      success: true,
      message: "Đã xác nhận giao hàng thành công.",
    });
  }

  return NextResponse.json(
    { error: "Bạn không có quyền thực hiện thao tác này." },
    { status: 403 }
  );
}