"use client";

import { useEffect, useState, useCallback } from "react";
import type { CostData } from "@/lib/cost-parser";
import { useOrchestrationStore } from "@/store/orchestrationStore";

type UseCostsResult = {
  data: CostData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useCosts(): UseCostsResult {
  const [data, setData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Orchestration 상태는 store에서 구독 (중복 polling 제거)
  const isRunning = useOrchestrationStore((s) => s.isRunning);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch("/api/costs");
        if (!res.ok) throw new Error("비용 데이터를 불러오는데 실패했습니다.");
        const costData: CostData = await res.json();
        if (!cancelled) {
          setData(costData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  // Orchestration이 running 상태일 때 5초마다 자동 갱신
  // (orchestrate/status polling은 store에서 이미 수행 중이므로 직접 호출하지 않음)
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [isRunning, refetch]);

  return { data, isLoading, error, refetch };
}
