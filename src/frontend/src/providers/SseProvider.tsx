"use client";

/**
 * SSE 단일 연결 관리자
 *
 * /api/tasks/watch에 하나의 EventSource를 유지하며 두 가지 이벤트를 처리:
 * - task-changed          → React Query 캐시 invalidate (tasks, requests)
 * - orchestration-status  → orchestrationStore 업데이트
 *
 * 앱 최상단(layout.tsx)에 마운트하여 전체 생명주기 동안 유지.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import type { OrchestrationStatusData } from "@/lib/orchestration-manager";

const RECONNECT_DELAY = 3000;
const DEBOUNCE_DELAY = 1000;

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;

      const es = new EventSource("/api/tasks/watch");
      esRef.current = es;

      // ── 태스크 파일 변경 ──
      es.addEventListener("task-changed", () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
        }, DEBOUNCE_DELAY);
      });

      // ── 오케스트레이션 상태 변경 ──
      es.addEventListener("orchestration-status", (e) => {
        if (!mountedRef.current) return;
        try {
          const data: OrchestrationStatusData = JSON.parse(e.data);
          const store = useOrchestrationStore.getState();
          const prevStatus = store.data.status;
          const justFinished =
            prevStatus === "running" &&
            (data.status === "completed" || data.status === "failed");

          useOrchestrationStore.setState(
            {
              data,
              isRunning: data.status === "running",
              justFinished: justFinished ? true : store.justFinished,
            },
            false,
            "orchestration/sse-update",
          );

          // 완료 시 관련 캐시 invalidate
          if (justFinished) {
            queryClient.invalidateQueries({ queryKey: queryKeys.costs.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.runHistory.all });
          }
        } catch {
          // JSON 파싱 실패 무시
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [queryClient]);

  return <>{children}</>;
}
