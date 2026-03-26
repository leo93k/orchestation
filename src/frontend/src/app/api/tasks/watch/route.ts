import fs from "fs";
import { TASKS_DIR } from "@/lib/paths";
import orchestrationManager from "@/lib/orchestration-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/watch — SSE 엔드포인트
 *
 * 두 가지 이벤트를 스트리밍:
 * - event: task-changed       → 태스크 파일이 변경되었을 때
 * - event: orchestration-status → 오케스트레이션 상태가 변경되었을 때 (data = JSON)
 */
export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      // ── 태스크 파일 변경 감지 ──
      let fsWatcher: fs.FSWatcher | null = null;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        fsWatcher = fs.watch(TASKS_DIR, { recursive: true }, (_event, filename) => {
          if (!filename?.endsWith(".md")) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => send("task-changed", "changed"), 500);
        });
      } catch {
        // TASKS_DIR 없으면 무시
      }

      // ── 오케스트레이션 상태 변경 감지 ──
      const onStatusChanged = (data: unknown) => {
        send("orchestration-status", JSON.stringify(data));
      };
      orchestrationManager.events.on("status-changed", onStatusChanged);

      // 연결 직후 현재 상태 전송
      const initialState = orchestrationManager.getState();
      send("orchestration-status", JSON.stringify({
        status: initialState.status,
        startedAt: initialState.startedAt,
        finishedAt: initialState.finishedAt,
        exitCode: initialState.exitCode,
        taskResults: initialState.taskResults,
      }));

      // ── 하트비트 (30초) — 연결 유지 ──
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
        }
      }, 30_000);

      // ── 정리 ──
      controller.close = new Proxy(controller.close, {
        apply(target, thisArg, args) {
          closed = true;
          fsWatcher?.close();
          orchestrationManager.events.off("status-changed", onStatusChanged);
          clearInterval(heartbeat);
          if (debounceTimer) clearTimeout(debounceTimer);
          return Reflect.apply(target, thisArg, args);
        },
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
