"use client";

import { useState } from "react";
import type { CostEntry } from "@/lib/cost-parser";

const PAGE_SIZE = 20;

interface CostTableProps {
  entries: CostEntry[];
}

function formatTimestamp(raw: string): string {
  // raw format: "YYYY-MM-DD HH:MM:SS"
  if (!raw || raw.length < 10) return raw ?? "-";
  return raw; // Already in YYYY-MM-DD HH:mm:ss format
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}

export function CostTable({ entries }: CostTableProps) {
  const sorted = [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const maxCost = sorted.length > 0 ? sorted[0].costUsd : 0;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs compact-table">
        <thead>
          <tr className="border-b border-border text-left text-[10px] text-muted-foreground uppercase tracking-wider">
            <th className="font-medium">시각</th>
            <th className="font-medium">Task ID</th>
            <th className="font-medium">Phase</th>
            <th className="font-medium">Model</th>
            <th className="font-medium text-right">Cost</th>
            <th className="font-medium text-right">Time</th>
            <th className="font-medium text-right">Turns</th>
            <th className="font-medium text-right">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry, idx) => {
            const isHighest = entry.costUsd === maxCost && maxCost > 0;
            const totalTokens =
              entry.inputTokens +
              entry.outputTokens +
              entry.cacheCreate +
              entry.cacheRead;

            return (
              <tr
                key={`${entry.taskId}-${entry.phase}-${entry.timestamp}-${idx}`}
                className={`border-b border-border last:border-b-0 transition-colors ${
                  isHighest
                    ? "bg-amber-500/10 text-amber-300 font-semibold"
                    : "hover:bg-muted/50"
                }`}
              >
                <td>
                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </td>
                <td>
                  <span className={isHighest ? "text-amber-500" : "font-mono"}>
                    {entry.taskId}
                  </span>
                </td>
                <td>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      entry.phase === "task"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-purple-500/15 text-purple-400"
                    }`}
                  >
                    {entry.phase}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {entry.model}
                  </span>
                </td>
                <td className="text-right font-mono">
                  ${entry.costUsd.toFixed(4)}
                </td>
                <td className="text-right font-mono">
                  {formatDuration(entry.durationMs)}
                </td>
                <td className="text-right font-mono">
                  {entry.turns}
                </td>
                <td className="text-right font-mono">
                  {totalTokens.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border"
        >
          더보기 ({sorted.length - visibleCount}건 남음)
        </button>
      )}
    </div>
  );
}
