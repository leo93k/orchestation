"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE_CLASS =
  "text-sm prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded";

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className={PROSE_CLASS}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
