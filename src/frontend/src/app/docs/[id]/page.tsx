"use client";

import { use } from "react";
import { usePrds } from "@/hooks/usePrds";
import { BookOpen } from "lucide-react";

export default function DocsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { prds, isLoading } = usePrds();

  if (isLoading) {
    return <div className="text-xs text-muted-foreground p-4">Loading...</div>;
  }

  const prd = prds.find((p) => p.id === id);

  if (!prd) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Document not found: {id}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-[11px] text-muted-foreground font-mono">{prd.id}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          prd.status === "done" ? "bg-emerald-500/15 text-emerald-400" :
          prd.status === "in_progress" ? "bg-blue-500/15 text-blue-400" :
          "bg-zinc-500/15 text-zinc-400"
        }`}>
          {prd.status}
        </span>
      </div>
      <h1 className="text-lg font-semibold mb-4">{prd.title}</h1>

      {/* Sprints */}
      {prd.sprints.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Sprints
          </div>
          <div className="flex flex-wrap gap-1">
            {prd.sprints.map((s) => (
              <span key={s} className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Document content */}
      <div className="border-t border-border pt-4">
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
          {prd.content || "내용 없음"}
        </div>
      </div>
    </div>
  );
}
