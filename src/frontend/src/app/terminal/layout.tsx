"use client";

import { PageSidebar } from "@/components/sidebar";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <PageSidebar />
      <main className="flex-1 overflow-auto bg-background px-4 py-3">
        <div className="content-container">{children}</div>
      </main>
    </div>
  );
}
