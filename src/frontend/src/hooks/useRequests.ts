"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface RequestItem {
  id: string;
  title: string;
  status: "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected";
  priority: "high" | "medium" | "low";
  created: string;
  updated: string;
  content: string;
  sort_order: number;
}

export function useRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRequests = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsLoading(true);
      const res = await fetch("/api/requests", { signal: controller.signal });
      if (!res.ok) throw new Error("요청 데이터를 불러오는데 실패했습니다.");
      const data: RequestItem[] = await res.json();
      if (isMountedRef.current) {
        setRequests(data);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors — they are expected on unmount or re-fetch
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "오류 발생");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchRequests();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRequests]);

  const createRequest = useCallback(async (title: string, content: string, priority: string) => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, priority }),
    });
    if (!res.ok) throw new Error("요청 생성에 실패했습니다.");
    const data = await res.json();
    if (isMountedRef.current) {
      await fetchRequests();
    }
    return data;
  }, [fetchRequests]);

  const updateRequest = useCallback(async (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("요청 수정에 실패했습니다.");
    if (isMountedRef.current) {
      await fetchRequests();
    }
  }, [fetchRequests]);

  const deleteRequest = useCallback(async (id: string) => {
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("요청 삭제에 실패했습니다.");
    if (isMountedRef.current) {
      await fetchRequests();
    }
  }, [fetchRequests]);

  const reorderRequest = useCallback(async (id: string, direction: "up" | "down") => {
    const res = await fetch(`/api/requests/${id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!res.ok) throw new Error("순서 변경에 실패했습니다.");
    if (isMountedRef.current) {
      await fetchRequests();
    }
  }, [fetchRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, isLoading, error, pendingCount, createRequest, updateRequest, deleteRequest, reorderRequest, refetch: fetchRequests };
}
