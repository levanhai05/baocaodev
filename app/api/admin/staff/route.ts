
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";

// Lấy danh sách nhân viên và chi nhánh
export async function GET(req: Request) {
  try {
    const db = await requireAdmin(req);

    if (!db) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const { data: staffRows, error: staffError } = await db
      .from("staff")
      .select("user_id, name, role, store_id, active, created_at")
      .order("created_at", { ascending: false });

    if (staffError) throw staffError;

    const staff = await Promise.all(
      (staffRows ?? []).map(async (item) => {
        const { data } = await db.auth.admin.getUserById(item.user_id);

        return {
          ...item,
          email: data.user?.email ?? "",
        };
      })
    );

    const { data: stores, error: storeError } = await db
      .from("stores")
      .select("id, name, active")
      .eq("active", true)
      .order("id");

    if (storeError) throw storeError;

    return NextResponse.json({ staff, stores: stores ?? [] });
  } catch (error) {
    console.error("GET staff error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách nhân viên." },
      { status: 500 }
    );
  }
}

// Tạo tài khoản nhân viên
export async function POST(req: Request) {
  try {
    const db = await requireAdmin(req);

    if (!db) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = body.role;
    const storeId = Number(body.store_id);

    if (!name || !email || !["kitchen", "shipper"].includes(role) || !Number.isInteger(storeId)) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ tên, email, vai trò và chi nhánh hợp lệ." },
        { status: 400 }
      );
    }

    const { data: store, error: storeError } = await db
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("active", true)
      .maybeSingle();

    if (storeError || !store) {
      return NextResponse.json(
        { error: "Chi nhánh không tồn tại hoặc đang ngừng hoạt động." },
        { status: 400 }
      );
    }

    const { data: created, error: createError } =
      await db.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    if (!created.user) {
      return NextResponse.json(
        { error: "Không tạo được tài khoản đăng nhập." },
        { status: 500 }
      );
    }

    const { error: insertError } = await db.from("staff").insert({
      user_id: created.user.id,
      name,
      role,
      store_id: storeId,
      active: true,
    });

    if (insertError) {
      await db.auth.admin.deleteUser(created.user.id);
      throw insertError;
    }

    return NextResponse.json({
      message: "Tạo nhân viên thành công.",
      user_id: created.user.id,
    });
  } catch (error) {
    console.error("POST staff error:", error);
    return NextResponse.json(
      { error: "Không thể tạo nhân viên. Vui lòng kiểm tra lại thông tin." },
      { status: 500 }
    );
  }
}

// Cập nhật thông tin nhân viên
export async function PUT(req: Request) {
  try {
    const db = await requireAdmin(req);

    if (!db) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const userId = String(body.user_id ?? "");
    const name = String(body.name ?? "").trim();
    const role = body.role;
    const storeId = Number(body.store_id);
    const active = body.active;

    if (
      !userId ||
      !name ||
      !["kitchen", "shipper"].includes(role) ||
      !Number.isInteger(storeId) ||
      typeof active !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Thông tin cập nhật không hợp lệ." },
        { status: 400 }
      );
    }

    const { data: store } = await db
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("active", true)
      .maybeSingle();

    if (!store) {
      return NextResponse.json(
        { error: "Chi nhánh không tồn tại hoặc đang ngừng hoạt động." },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from("staff")
      .update({ name, role, store_id: storeId, active })
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Không tìm thấy nhân viên cần cập nhật." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Cập nhật nhân viên thành công." });
  } catch (error) {
    console.error("PUT staff error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật nhân viên." },
      { status: 500 }
    );
  }
}

// Xóa tài khoản nhân viên
export async function DELETE(req: Request) {
  try {
    const db = await requireAdmin(req);
    if (!db) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

        const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const userId = searchParams.get("user_id") ?? body.user_id;

    if (!userId) {
      return NextResponse.json(
        { error: "Thiếu mã nhân viên." },
        { status: 400 }
      );
    }

    const { error: staffError } = await db
      .from("staff")
      .delete()
      .eq("user_id", userId);

    if (staffError) throw staffError;

    const { error: authError } = await db.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Delete auth user error:", authError);
      return NextResponse.json(
        { error: "Đã xóa hồ sơ nhân viên nhưng chưa xóa được tài khoản đăng nhập." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Xóa nhân viên thành công." });
  } catch (error) {
    console.error("DELETE staff error:", error);
    return NextResponse.json(
      { error: "Không thể xóa nhân viên." },
      { status: 500 }
    );
  }
}
