import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
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
      <body>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-background px-4 py-3">
            <div className="content-container">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
