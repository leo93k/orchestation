"use client";

/**
 * useRequests
 *
 * TasksStore의 얇은 래퍼입니다 (requests 슬라이스).
 * 실제 데이터 fetching 및 SSE는 tasksStore 모듈에서 싱글턴으로 관리됩니다.
 */

import { useTasksStore } from "@/store/tasksStore";

// Re-export type for backward compatibility
export type { RequestItem } from "@/store/tasksStore";

export function useRequests() {
  const requests = useTasksStore((s) => s.requests);
  const isLoading = useTasksStore((s) => s.isRequestsLoading);
  const error = useTasksStore((s) => s.requestsError);
  const fetchRequests = useTasksStore((s) => s.fetchRequests);
  const createRequest = useTasksStore((s) => s.createRequest);
  const updateRequest = useTasksStore((s) => s.updateRequest);
  const deleteRequest = useTasksStore((s) => s.deleteRequest);
  const reorderRequest = useTasksStore((s) => s.reorderRequest);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return {
    requests,
    isLoading,
    error,
    pendingCount,
    createRequest,
    updateRequest,
    deleteRequest,
    reorderRequest,
    refetch: fetchRequests,
  };
}
