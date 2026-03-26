"use client";

import { useEffect, useState, useCallback } from "react";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";
import { useOrchestrationStore } from "@/store/orchestrationStore";

export type SprintListItem = {
  id: string;
  title: string;
  status: string;
  progress: { done: number; total: number };
};

type UseSprintsResult = {
  sprints: SprintListItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useSprints(): UseSprintsResult {
  const [sprints, setSprints] = useState<SprintListItem[]>([]);
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
        const [sprintsRes, tasksRes] = await Promise.all([
          fetch("/api/sprints"),
          fetch("/api/tasks"),
        ]);

        if (!sprintsRes.ok || !tasksRes.ok)
          throw new Error("데이터를 불러오는데 실패했습니다.");

        const sprintData: SprintData[] = await sprintsRes.json();
        const tasks: TaskFrontmatter[] = await tasksRes.json();

        const taskStatusMap = new Map<string, string>();
        for (const task of tasks) {
          taskStatusMap.set(task.id, task.status);
        }

        const items: SprintListItem[] = sprintData.map((sprint) => {
          const total = sprint.tasks.length;
          const done = sprint.tasks.filter(
            (id) => taskStatusMap.get(id) === "done",
          ).length;
          return {
            id: sprint.id,
            title: `${sprint.id}: ${sprint.title}`,
            status: sprint.status,
            progress: { done, total },
          };
        });

        if (!cancelled) {
          setSprints(items);
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

  return { sprints, isLoading, error, refetch };
}
