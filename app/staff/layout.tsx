"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";
import StaffBell from "@/components/StaffBell";

type Role = "kitchen" | "shipper";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [ok, setOk] = useState(false);
  const [denied, setDenied] = useState<"" | "denied" | "error">("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [channel, setChannel] = useState("");

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      setOk(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!alive) return;

      if (!session) {
        router.replace("/admin/login");
        return;
      }

      setEmail(session.user.email ?? "");

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (adminError) {
        setDenied("error");
        return;
      }

      // Admin được phép truy cập khu vực nhân viên
      if (admin) {
        setIsAdmin(true);
        setRole(null);
        setOk(true);
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("user_id,role,store_id,active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (staffError) {
        setDenied("error");
        return;
      }

      if (!staff || !staff.active) {
        setDenied("denied");
        return;
      }

      if (staff.role !== "kitchen" && staff.role !== "shipper") {
        setDenied("denied");
        return;
      }

      const staffRole = staff.role as Role;
      setRole(staffRole);
      setChannel(
        staffRole === "kitchen"
          ? `staff-kitchen-${staff.store_id}`
          : `staff-shipper-${session.user.id}`
      );

      const target =
        staffRole === "kitchen"
          ? "/staff/kitchen"
          : "/staff/shipper";

      // Nhân viên không được vào trang của vai trò khác
      if (pathname === "/staff" || pathname !== target) {
        router.replace(target);
        return;
      }

      setOk(true);
    }

    checkAccess();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/admin/login");
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (denied) {
    return (
      <main className="login">
        <div className="login-box">
          <div className="logo">
            <span className="logo-mark">
              <LogoMark />
            </span>
            Phố Burger<i>.</i>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div className="eyebrow">
              {denied === "denied"
                ? "Không có quyền truy cập"
                : "Có lỗi xảy ra"}
            </div>

            <h1>
              {denied === "denied"
                ? "Tài khoản chưa được cấp quyền"
                : "Không kiểm tra được quyền"}
            </h1>

            <p className="auth-sub">
              {denied === "denied" ? (
                <>
                  Tài khoản <b>{email}</b> chưa được cấp quyền hoạt động.
                  Vui lòng liên hệ Admin.
                </>
              ) : (
                "Không đọc được dữ liệu phân quyền. Vui lòng thử lại."
              )}
            </p>

            {denied === "error" && (
              <button className="btn" onClick={() => location.reload()}>
                Thử lại
              </button>
            )}

            <button
              className="link"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/admin/login");
              }}
            >
              Đăng xuất / đăng nhập tài khoản khác
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!ok) {
    return (
      <p className="notice" style={{ margin: "2rem" }}>
        Đang kiểm tra vai trò và chi nhánh...
      </p>
    );
  }

  return (
    <div className="staffwrap">
      <header className="staffbar">
        <b className="logo" style={{ fontSize: 18 }}>
          <span
            className="logo-mark"
            style={{ width: 30, height: 30 }}
          >
            <LogoMark size={18} />
          </span>
          Phố Burger · {isAdmin ? "Quản trị" : role === "kitchen" ? "Khu vực bếp" : "Khu vực shipper"}
        </b>

        <nav>
          {isAdmin && <Link href="/admin">Trang quản trị</Link>}

          {channel && <StaffBell channel={channel} />}

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/admin/login");
            }}
          >
            Đăng xuất
          </button>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}