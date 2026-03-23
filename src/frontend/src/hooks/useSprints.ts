"use client";

import { useEffect, useState, useCallback } from "react";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";

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

        if (!sprintsRes.ok || !tasksRes.ok) {
          throw new Error("데이터를 불러오는데 실패했습니다.");
        }

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
            err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다.",
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

  // Auto-poll when orchestration is running (every 5s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/orchestrate/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "running") {
            refetch();
          }
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch]);

  return { sprints, isLoading, error, refetch };
}
