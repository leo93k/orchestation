"use client";

/**
 * useOrchestrationStatus
 *
 * Orchestration Store의 얇은 래퍼입니다.
 * 실제 polling은 orchestrationStore 모듈에서 싱글턴으로 관리됩니다.
 */

import { useOrchestrationStore } from "@/store/orchestrationStore";

// Re-export types for backward compatibility
export type { OrchestrationStatus, OrchestrationStatusData } from "@/store/orchestrationStore";

type UseOrchestrationStatusResult = {
  data: import("@/store/orchestrationStore").OrchestrationStatusData;
  isRunning: boolean;
  justFinished: boolean;
  clearFinished: () => void;
};

export function useOrchestrationStatus(): UseOrchestrationStatusResult {
  const data = useOrchestrationStore((s) => s.data);
  const isRunning = useOrchestrationStore((s) => s.isRunning);
  const justFinished = useOrchestrationStore((s) => s.justFinished);
  const clearFinished = useOrchestrationStore((s) => s.clearFinished);

  return { data, isRunning, justFinished, clearFinished };
}
