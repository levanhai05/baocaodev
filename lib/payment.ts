// Mã QR chuyển khoản VietQR (chỉ hiện khi đã cấu hình ngân hàng trong .env)
export function bankQr(code: string, amount: number) {
  const bank = process.env.NEXT_PUBLIC_BANK_ID;
  const acc = process.env.NEXT_PUBLIC_BANK_ACCOUNT;
  const name = process.env.NEXT_PUBLIC_BANK_NAME ?? "";
  if (!bank || !acc) return null;
  return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent("Thanh toan don " + code)}&accountName=${encodeURIComponent(name)}`;
}
