"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";
import { queryKeys } from "@/lib/query-keys";

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

async function fetchSprints(): Promise<SprintListItem[]> {
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

  return sprintData.map((sprint) => {
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
}

export function useSprints(): UseSprintsResult {
  const queryClient = useQueryClient();

  const { data: sprints = [], isLoading, error } = useQuery({
    queryKey: queryKeys.sprints.list(),
    queryFn: fetchSprints,
    staleTime: 5_000,
  });

  return {
    sprints,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.") : null,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all }),
  };
}
