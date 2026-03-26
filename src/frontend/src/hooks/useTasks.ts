"use client";

/**
 * useTasks
 *
 * TasksStore의 얇은 래퍼입니다.
 * 실제 데이터 fetching 및 SSE는 tasksStore 모듈에서 싱글턴으로 관리됩니다.
 */

import { useCallback } from "react";
import { useTasksStore } from "@/store/tasksStore";
import type { WaterfallGroup } from "@/types/waterfall";

type UseTasksResult = {
  groups: WaterfallGroup[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useTasks(): UseTasksResult {
  const groups = useTasksStore((s) => s.groups);
  const isLoading = useTasksStore((s) => s.isTasksLoading);
  const error = useTasksStore((s) => s.tasksError);
  const fetchTasks = useTasksStore((s) => s.fetchTasks);

  const refetch = useCallback(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { groups, isLoading, error, refetch };
}
