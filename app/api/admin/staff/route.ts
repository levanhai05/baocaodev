import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server";

const deny = () => NextResponse.json({ error: "Không có quyền." }, { status: 403 });
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  const db = await requireAdmin(req);
  if (!db) return deny();
  const { data } = await db.from("staff").select("user_id,name,created_at").order("created_at");
  const out = await Promise.all((data ?? []).map(async (s) => ({
    ...s, email: (await db.auth.admin.getUserById(s.user_id)).data.user?.email ?? "",
  })));
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const db = await requireAdmin(req);
  if (!db) return deny();
  const b = await req.json().catch(() => null);
  if (!b?.email?.trim() || (b?.password ?? "").length < 6) return err("Nhập email và mật khẩu (tối thiểu 6 ký tự).");
  const { data, error } = await db.auth.admin.createUser({ email: b.email.trim(), password: b.password, email_confirm: true });
  if (error || !data.user) return err(error?.message.includes("already") ? "Email này đã có tài khoản." : error?.message ?? "Không tạo được tài khoản.");
  const r = await db.from("staff").insert({ user_id: data.user.id, name: b.name?.trim() || null });
  if (r.error) { await db.auth.admin.deleteUser(data.user.id); return err(r.error.message, 500); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = await requireAdmin(req);
  if (!db) return deny();
  const { user_id } = await req.json().catch(() => ({}));
  const { data: s } = await db.from("staff").select("user_id").eq("user_id", user_id ?? "").maybeSingle();
  if (!s) return err("Không tìm thấy nhân viên.", 404); // chặn xoá nhầm tài khoản không phải nhân viên
  await db.auth.admin.deleteUser(user_id);
  return NextResponse.json({ ok: true });
}
