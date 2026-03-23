"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type OrchestrationStatus = "idle" | "running" | "completed" | "failed";

export interface OrchestrationStatusData {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
}

type UseOrchestrationStatusResult = {
  data: OrchestrationStatusData;
  isRunning: boolean;
  justFinished: boolean;
  clearFinished: () => void;
};

const POLL_INTERVAL_IDLE = 5000;
const POLL_INTERVAL_RUNNING = 2000;

export function useOrchestrationStatus(): UseOrchestrationStatusResult {
  const [data, setData] = useState<OrchestrationStatusData>({
    status: "idle",
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    taskResults: [],
  });
  const [justFinished, setJustFinished] = useState(false);
  const prevStatusRef = useRef<OrchestrationStatus>("idle");

  const clearFinished = useCallback(() => {
    setJustFinished(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;

      try {
        const res = await fetch("/api/orchestrate/status");
        if (res.ok) {
          const json: OrchestrationStatusData = await res.json();
          if (!cancelled) {
            // Detect transition from running → completed/failed
            if (
              prevStatusRef.current === "running" &&
              (json.status === "completed" || json.status === "failed")
            ) {
              setJustFinished(true);
            }
            prevStatusRef.current = json.status;
            setData(json);
          }
        }
      } catch {
        // silently ignore fetch errors
      }

      if (!cancelled) {
        const interval =
          prevStatusRef.current === "running"
            ? POLL_INTERVAL_RUNNING
            : POLL_INTERVAL_IDLE;
        timeoutId = setTimeout(poll, interval);
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    data,
    isRunning: data.status === "running",
    justFinished,
    clearFinished,
  };
}
