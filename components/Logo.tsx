// Tên thương hiệu + biểu tượng: chỉ cần sửa ở đây, mọi nơi sẽ đổi theo.
export const BRAND = "Phố Burger";

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 10a8 7 0 0 1 16 0z" />
      <circle cx="9" cy="6.6" r=".9" fill="var(--orange)" />
      <circle cx="12.5" cy="5.2" r=".9" fill="var(--orange)" />
      <circle cx="15.5" cy="7" r=".9" fill="var(--orange)" />
      <path d="M3.5 13c1.6 1.4 2.6 1.4 4.2 0s2.6-1.4 4.2 0 2.6 1.4 4.2 0 2.6-1.4 4.4 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="15" width="16" height="3" rx="1.5" />
      <path d="M4.5 19.5h15a0 0 0 0 1 0 0 2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
    </svg>
  );
}