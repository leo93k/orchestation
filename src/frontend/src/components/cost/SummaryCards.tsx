"use client";

import type { CostEntry, TaskCostSummary } from "@/lib/cost-parser";
import { aggregateCostByPhase } from "@/lib/cost-phase";

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

  // Collect unique models across all entries
  const uniqueModels = new Set(entries.map((e) => e.model).filter((m) => m && m !== "unknown"));
  const modelsDisplay = uniqueModels.size > 0 ? Array.from(uniqueModels).join(", ") : "—";

  // Phase-based cost aggregation
  const phaseSummary = aggregateCostByPhase(entries);

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
      <div className="stat-item">
        <span className="stat-label">Phase Cost</span>
        <span className="stat-value text-[10px]">
          <span style={{ color: "#3b82f6" }}>Task ${phaseSummary.taskCost.toFixed(2)} ({phaseSummary.taskPct}%)</span>
          {" / "}
          <span style={{ color: "#a855f7" }}>Review ${phaseSummary.reviewCost.toFixed(2)} ({phaseSummary.reviewPct}%)</span>
          {phaseSummary.otherCost > 0 && (
            <>
              {" / "}
              <span style={{ color: "#6b7280" }}>기타 ${phaseSummary.otherCost.toFixed(2)} ({phaseSummary.otherPct}%)</span>
            </>
          )}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Models</span>
        <span className="stat-value text-[10px]">{modelsDisplay}</span>
      </div>
    </div>
  );
}
