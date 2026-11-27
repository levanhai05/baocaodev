
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/Logo";

declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function Login() {
  const router = useRouter();
  const btn = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const checkRole = useCallback(async (userId: string) => {
    setBusy(true);
    setError("");

    try {
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (adminError) throw adminError;

      if (admin) {
        router.replace("/admin");
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("user_id,role,active")
        .eq("user_id", userId)
        .maybeSingle();

      if (staffError) throw staffError;

      if (!staff) {
        await supabase.auth.signOut();
        setError("Tài khoản Google chưa được Admin cấp quyền.");
        setBusy(false);
        return;
      }

      if (!staff.active) {
        await supabase.auth.signOut();
        setError("Tài khoản nhân viên đã bị khóa. Liên hệ Admin.");
        setBusy(false);
        return;
      }

      if (staff.role === "kitchen") {
        router.replace("/staff/kitchen");
        return;
      }

      if (staff.role === "shipper") {
        router.replace("/staff/shipper");
        return;
      }

      await supabase.auth.signOut();
      setError("Tài khoản chưa được phân vai trò Bếp hoặc Shipper.");
      setBusy(false);
    } catch {
      setError("Không kiểm tra được quyền truy cập. Vui lòng thử lại.");
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    let alive = true;

    async function checkSession() {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error) {
        setError("Không kiểm tra được phiên đăng nhập.");
        return;
      }

      if (session) {
        await checkRole(session.user.id);
      }
    }

    checkSession();

    return () => {
      alive = false;
    };
  }, [checkRole]);

  useEffect(() => {
    if (!ready || !btn.current) return;

    if (!CLIENT_ID) {
      setError("Thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID trong .env.local.");
      return;
    }

    if (!window.crypto?.subtle) {
      setError("Vui lòng sử dụng HTTPS hoặc localhost.");
      return;
    }

    if (!window.google?.accounts?.id) {
      setError("Không tải được Google Sign-In.");
      return;
    }

    let alive = true;

    async function initializeGoogle() {
      try {
        const rawNonce = crypto.randomUUID();
        const hashedNonce = await sha256Hex(rawNonce);

        if (!alive || !btn.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashedNonce,

          callback: async (response: { credential: string }) => {
            if (!alive) return;

            setBusy(true);
            setError("");

            const { data, error } =
              await supabase.auth.signInWithIdToken({
                provider: "google",
                token: response.credential,
                nonce: rawNonce,
              });

            if (error || !data.user) {
              setBusy(false);
              setError("Đăng nhập Google thất bại. Vui lòng thử lại.");
              return;
            }

            await checkRole(data.user.id);
          },
        });

        window.google.accounts.id.renderButton(btn.current, {
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          width: 340,
        });
      } catch {
        if (alive) setError("Không khởi tạo được đăng nhập Google.");
      }
    }

    initializeGoogle();

    return () => {
      alive = false;
    };
  }, [ready, checkRole]);

  return (
    <main className="login">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setError("Không tải được dịch vụ đăng nhập Google.")}
      />

      <div className="login-box">
        <div className="logo">
          <span className="logo-mark">
            <LogoMark />
          </span>
          Phố Burger<i>.</i>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="eyebrow">Khu vực nội bộ</div>

          <h1>Đăng nhập nội bộ</h1>

          <p className="auth-sub">
            Dành cho quản trị viên, nhân viên bếp và shipper.
            Đăng nhập bằng tài khoản Google đã được Admin cấp quyền.
          </p>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div
            ref={btn}
            style={{
              display: "flex",
              justifyContent: "center",
              opacity: busy ? 0.5 : 1,
              pointerEvents: busy ? "none" : "auto",
            }}
          />

          {busy && (
            <p className="auth-sub" style={{ textAlign: "center" }}>
              Đang kiểm tra tài khoản...
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
