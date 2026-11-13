"use client";
import { useState } from "react";
import { bankQr } from "@/lib/payment";
import { vnd } from "@/lib/types";

export default function BankTransfer({ code, total }: { code: string; total: number }) {
  const [copied, setCopied] = useState("");
  const qr = bankQr(code, total);
  const bank = (process.env.NEXT_PUBLIC_BANK_ID ?? "").toUpperCase();
  const acc = process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? "";
  const name = process.env.NEXT_PUBLIC_BANK_NAME ?? "";
  const content = "Thanh toan don " + code;

  const copy = (key: string, value: string) =>
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });

  if (!qr) {
    return <p>Nhân viên sẽ liên hệ gửi số tài khoản để bạn chuyển khoản <b>{vnd(total)}</b>.</p>;
  }

  const rows: [string, string, string][] = [
    ["bank", "Ngân hàng", bank],
    ["acc", "Số tài khoản", acc],
    ["name", "Chủ tài khoản", name],
    ["amount", "Số tiền", String(total)],
    ["content", "Nội dung", content],
  ];

  return (
    <div className="bt">
      <p className="bt-hint">Quét mã QR bằng app ngân hàng, số tiền và nội dung sẽ tự điền.</p>
      <img src={qr} alt="Mã QR chuyển khoản" className="qr" />
      <div className="bt-rows">
        {rows.map(([k, label, value]) => (
          <div className="bt-row" key={k}>
            <small>{label}</small>
            <b>{k === "amount" ? vnd(total) : value}</b>
            <button type="button" onClick={() => copy(k, value)}>{copied === k ? "Đã chép" : "Chép"}</button>
          </div>
        ))}
      </div>
      <p className="bt-note">Vui lòng giữ nguyên nội dung chuyển khoản để cửa hàng đối soát đơn nhanh hơn.</p>
    </div>
  );
}