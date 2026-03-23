"use client";

import type { CostEntry, TaskCostSummary } from "@/lib/cost-parser";

interface SummaryCardsProps {
  entries: CostEntry[];
  summaryByTask: TaskCostSummary[];
}

export function SummaryCards({ entries, summaryByTask }: SummaryCardsProps) {
  const totalCost = entries.reduce((sum, e) => sum + e.costUsd, 0);
  const totalTasks = summaryByTask.length;
  const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;
  const totalTokens = entries.reduce(
    (sum, e) => sum + e.inputTokens + e.outputTokens + e.cacheCreate + e.cacheRead,
    0,
  );

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">Total Cost</span>
        <span className="stat-value">${totalCost.toFixed(4)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Tasks</span>
        <span className="stat-value">{totalTasks}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Avg/Task</span>
        <span className="stat-value">${avgCostPerTask.toFixed(4)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Tokens</span>
        <span className="stat-value">{totalTokens.toLocaleString()}</span>
      </div>
    </div>
  );
}
