
import { createClient } from "@supabase/supabase-js";

// Chỉ sử dụng file này trong API routes / server code.
export const service = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );

const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const genCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => A[b % A.length]
  ).join("");

export function clientIp(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";

  return ip && !ip.includes(":") ? ip : "127.0.0.1";
}

// Kiểm tra Admin.
export async function requireAdmin(req: Request) {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const db = service();
  const { data } = await db.auth.getUser(token);

  if (!data.user) return null;

  const { data: admin } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return admin ? db : null;
}

// Kiểm tra nhân viên và vai trò ở phía server.
export async function requireStaff(
  req: Request,
  allowedRoles?: ("kitchen" | "shipper")[]
) {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const db = service();

  const { data: authData, error: authError } =
    await db.auth.getUser(token);

  if (authError || !authData.user) return null;

  const { data: staff, error: staffError } = await db
    .from("staff")
    .select("user_id, name, role, store_id, active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (staffError || !staff) return null;
  if (!staff.active) return null;
  if (staff.store_id === null) return null;

  if (staff.role !== "kitchen" && staff.role !== "shipper") {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    return null;
  }

  return {
    db,
    user: authData.user,
    staff,
  };
}
