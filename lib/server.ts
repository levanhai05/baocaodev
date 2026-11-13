import { createClient } from "@supabase/supabase-js";

// Chỉ import file này trong API routes / server code
export const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const genCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => A[b % A.length]).join("");

export function clientIp(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  return ip && !ip.includes(":") ? ip : "127.0.0.1";
}

// Trả về client service-role nếu người gọi (Bearer token) là admin, ngược lại null
export async function requireAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const db = service();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: a } = await db.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return a ? db : null;
}
