// Gửi email qua Resend (https://resend.com). Không có RESEND_API_KEY thì bỏ qua.
export async function sendMail(to: string | undefined, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Pho Burger <onboarding@resend.dev>", to, subject, html }),
    });
  } catch {}
}