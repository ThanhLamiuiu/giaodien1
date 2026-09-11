import type { ReactNode } from "react";

export const metadata = {
  title: "Prototype phân bổ phòng học",
  description: "Kiểm thử thuật toán phân bổ phòng học dựa trên TKB có sẵn",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
