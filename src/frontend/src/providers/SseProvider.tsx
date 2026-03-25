"use client";

/**
 * SSE 단일 연결 관리자
 *
 * 기존에는 useRequests, useTasks 두 곳에서 각각 /api/tasks/watch에 연결했음.
 * 이 컴포넌트가 단 하나의 SSE 연결을 유지하고, 이벤트 수신 시 관련 쿼리를 invalidate함.
 *
 * 앱 최상단(layout.tsx)에 마운트하여 전체 생명주기 동안 유지.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const RECONNECT_DELAY = 2000;
const DEBOUNCE_DELAY = 1000;

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const invalidateTaskRelated = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        // tasks, requests 모두 invalidate
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      }, DEBOUNCE_DELAY);
    };

    const connect = () => {
      if (!mountedRef.current) return;

      const es = new EventSource("/api/tasks/watch");
      esRef.current = es;

      es.onmessage = (e) => {
        if (e.data === "changed") {
          invalidateTaskRelated();
        }
      };

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
