import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestration Dashboard",
  description: "오케스트레이션 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
