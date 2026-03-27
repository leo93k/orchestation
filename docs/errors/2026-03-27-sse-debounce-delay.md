# SSE 이벤트 debounce로 인한 사이드바 상태 갱신 지연 (2026-03-27)

## 요약
태스크 개별 실행/중지 시 상세 페이지와 사이드바의 status 갱신에 ~1.5초 체감 지연이 발생. 파일 변경 감지부터 UI 반영까지 debounce가 2단계로 걸려있어 누적됨.

## 증상
- 실행 버튼 클릭 → 상세 페이지는 즉시 "태스크 실행 중..." 배너 표시
- 하지만 사이드바의 status 텍스트(Pending → In Progress)는 1~2초 후에 갱신
- 중지 시에도 동일 지연

## 현재 데이터 흐름

```
updateTaskFileStatus() — 파일에 status 기록
        ↓
fs.watch(TASKS_DIR) — 서버 측 파일 감시
        ↓ (500ms debounce)
SSE "task-changed" 이벤트 전송
        ↓
SseProvider 수신
        ↓ (1000ms debounce)
React Query invalidate + useTasksStore.fetchRequests()
        ↓
사이드바 리렌더링
```

**총 지연: ~1500ms (500ms + 1000ms)**

## 근본 원인

### 1. 서버 측 debounce (500ms)
`/api/tasks/watch/route.ts` line 37:
```typescript
debounceTimer = setTimeout(() => send("task-changed", "changed"), 500);
```
태스크 파일이 자주 변경될 수 있으므로(git commit 등) 500ms debounce로 SSE 이벤트를 묶음 처리.

### 2. 클라이언트 측 debounce (1000ms)
`SseProvider.tsx` line 41:
```typescript
debounceTimerRef.current = setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
  useTasksStore.getState().fetchRequests();
}, DEBOUNCE_DELAY); // 1000ms
```
SSE 이벤트가 연속으로 올 수 있으므로 1000ms debounce로 API 호출 횟수 제한.

### 3. 상세 페이지 vs 사이드바 체감 차이
- **상세 페이지**: `handleRun`에서 `setRunStatus("running")`을 즉시 호출 + 2초 후 refetch → 배너는 즉시, status 텍스트는 SSE 경로
- **사이드바**: SSE → zustand store → 리렌더링이 유일한 경로 → 전체 debounce를 거침

## 개선안

### 1. debounce 값 축소 (즉시 적용 가능)

현재 값이 보수적이므로 절반으로 줄여도 안전함:

| 위치 | 현재 | 제안 |
|------|------|------|
| 서버 `/api/tasks/watch` | 500ms | 200ms |
| 클라이언트 `SseProvider` | 1000ms | 300ms |
| **총 지연** | **~1500ms** | **~500ms** |

```typescript
// /api/tasks/watch/route.ts
debounceTimer = setTimeout(() => send("task-changed", "changed"), 200);

// SseProvider.tsx
const DEBOUNCE_DELAY = 300;
```

### 2. 개별 실행 시 즉시 store 갱신 (SSE 우회)

TaskRunnerManager가 status를 변경할 때 SSE를 기다리지 않고, 프론트엔드에서 직접 zustand store를 갱신:

```typescript
// handleRun에서 POST 성공 후
setRunStatus("running");
setTask((prev) => prev ? { ...prev, status: "in_progress" } : null);
// zustand store도 즉시 갱신
useTasksStore.getState().updateRequestStatus(id, "in_progress");
```

이렇게 하면 **사이드바도 즉시 갱신**되고, SSE는 나중에 도착해서 확인(reconcile) 역할만 함.

### 3. SSE 이벤트에 변경 내용 포함 (서버 측 개선)

현재 SSE `task-changed` 이벤트는 "changed"라는 문자열만 보냄. 변경된 태스크 ID와 새 status를 함께 보내면 클라이언트에서 전체 refetch 없이 해당 항목만 갱신 가능:

```typescript
// 서버: /api/tasks/watch
send("task-changed", JSON.stringify({ taskId: "TASK-253", status: "in_progress" }));

// 클라이언트: SseProvider
es.addEventListener("task-changed", (e) => {
  const { taskId, status } = JSON.parse(e.data);
  useTasksStore.getState().patchRequestStatus(taskId, status);
});
```

이 방식은 debounce 자체를 없앨 수 있음 — 전체 refetch가 아니라 단일 항목 patch이므로 부담이 거의 없음.

## 우선순위

| 순서 | 개선안 | 효과 | 난이도 |
|------|--------|------|--------|
| 1 | debounce 값 축소 | 1500ms → 500ms | 낮음 (값만 변경) |
| 2 | 개별 실행 시 즉시 store 갱신 | 사이드바 즉시 반영 | 낮음 |
| 3 | SSE에 변경 내용 포함 | debounce 제거 가능 | 중간 |

**권장: 1+2를 즉시 적용.** 3은 구조 개선 시 함께 진행.
