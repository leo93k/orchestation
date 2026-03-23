"use client";

import { useEffect, useState, useCallback } from "react";

export interface RunHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "failed";
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
  totalCostUsd: number;
  totalDurationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
}

type UseRunHistoryResult = {
  runs: RunHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useRunHistory(): UseRunHistoryResult {
  const [runs, setRuns] = useState<RunHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/run-history");
        if (!res.ok) {
          throw new Error("실행 기록을 불러오는데 실패했습니다.");
        }
        const data = await res.json();
        if (!cancelled) {
          setRuns(data.runs || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다."
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

  return { runs, isLoading, error, refetch };
}
