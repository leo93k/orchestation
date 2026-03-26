# Memory Leak Analysis — Port 3000 OOM 원인 분석

> 작성일: 2026-03-26
> 상태: 분석 완료, 수정 대기

서비스 기동 후 메모리가 폭주하며 프로세스가 죽는 현상의 원인을 코드 레벨에서 분석한 문서.

---

## 1. CRITICAL — `/api/monitor` + `useMonitor` (1초 execSync 폭탄)

**파일:**
- `src/frontend/src/hooks/useMonitor.ts:45` — `refetchInterval: 1000`
- `src/frontend/src/app/api/monitor/route.ts:36,69,189,198`

**증상:** Monitor 페이지 진입 여부와 무관하게, `useMonitor` 훅이 마운트되면 **매 1초마다** `/api/monitor` 호출.

**API가 매 호출마다 하는 일:**

| 호출 | 위치 (route.ts) | 비용 |
|------|----------------|------|
| `execSync("ps axo pid=,ppid=")` | L36 | 전체 프로세스 트리 조회 + BFS 순회 |
| `execSync("ps aux \| grep claude")` | L69-71 | 프로세스 목록 파싱 |
| `execSync("ps -A \| wc -l")` | L189 | 프로세스 카운트 |
| `execSync("ps -M -A \| wc -l")` | L198 | 스레드 카운트 |
| `fs.readdirSync("/tmp")` | L16 | PID 파일 스캔 |

**문제:**
- execSync은 매번 자식 프로세스를 fork → 초당 4개 프로세스 스폰
- 각 execSync의 stdout 버퍼가 GC되기 전에 다음 호출 시작
- `getDescendantPids()`는 워커 PID 수만큼 반복 호출 → 워커 3개면 초당 12회 execSync
- **분당 최소 240회 프로세스 생성** → 메모리 + CPU 동시 폭주

**수정 방향:**
- `refetchInterval`을 5000~10000ms로 상향
- Monitor 페이지가 보일 때만 폴링 (`enabled: isVisible`)
- `getDescendantPids`를 1회 호출 후 맵 재사용 (현재는 워커마다 `ps axo` 재실행)
- execSync → `os.cpus()`, `/proc` 파일 기반으로 전환 (macOS 한정이면 최소 캐싱)

---

## 2. HIGH — `orchestrationStore.ts` 모듈 로드 시 자동 폴링

**파일:** `src/frontend/src/store/orchestrationStore.ts:93-94`

```ts
// Auto-start in browser environment
if (typeof window !== "undefined") {
  startOrchestrationPolling();
}
```

**문제:**
- 모듈이 import되는 순간 폴링 시작 → 페이지 진입 여부 무관
- HMR(Hot Module Replacement) 시 모듈 재실행 → `isPolling` 플래그가 리셋되어 **중복 폴링 루프** 생성 가능
- idle 상태에서도 5초마다 `/api/orchestrate/status` 계속 호출

**수정 방향:**
- 모듈 레벨 자동 시작 제거 → 컴포넌트 useEffect에서 명시적 시작/정지
- HMR 시 기존 타이머 정리: `if (module.hot) module.hot.dispose(stopOrchestrationPolling)`

---

## 3. HIGH — `tasksStore.ts` SSE 자동 연결 + 무한 재연결

**파일:** `src/frontend/src/store/tasksStore.ts:267-272`

```ts
if (typeof window !== "undefined") {
  useTasksStore.getState().fetchAll();  // 즉시 fetch
  startTasksSSE();                       // SSE 연결
}
```

**문제:**
- SSE `onerror` 시 2초 후 무조건 재연결 (L249) → 서버 에러 시 초당 0.5회 재연결 무한 루프
- HMR 시 `sseConnected` 플래그 리셋 → EventSource 중복 생성
- 각 EventSource 연결은 서버에서 `fs.watch` + `setInterval(keepAlive)` 유지 (watch/route.ts)
- 서버 측 watch/route.ts에서 `cancel()` 콜백 미구현 → 클라이언트가 닫아도 watcher+interval이 5분간 유지

**수정 방향:**
- 재연결에 exponential backoff 적용 (2s → 4s → 8s → max 30s)
- `sseConnected` 가드를 WeakRef 또는 window 이벤트 기반으로 변경
- watch/route.ts에 `cancel()` 콜백 추가하여 연결 종료 시 즉시 정리

---

## 4. HIGH — `tasks/[id]/page.tsx` setInterval 3중 중첩

**파일:** `src/frontend/src/app/tasks/[id]/page.tsx`

| useEffect 위치 | 간격 | 대상 API | 조건 |
|---------------|------|----------|------|
| L105 (LiveLogPanel) | 1.5s | `/api/tasks/{id}/logs` | taskId 변경 시 |
| L230 | 5s | `/api/orchestrate/status` | **무조건** (cleanup 있지만 항상 실행) |
| L258 | 2s | `/api/tasks/{id}/run` + `/api/requests/{id}` | runStatus === "running" |

**문제:**
- L230의 orchestration status 폴링은 이미 orchestrationStore에서 전역으로 하고 있음 → **완전 중복**
- LiveLogPanel이 마운트되면 추가 1.5초 폴링
- 태스크 상세 페이지 하나 열면 최대 3개 interval 동시 동작 → 초당 ~2.2회 API 호출

**수정 방향:**
- L230 제거 → `useOrchestrationStore`에서 `isPipelineRunning` 직접 구독
- LiveLogPanel은 SSE 또는 조건부 폴링으로 전환

---

## 5. MEDIUM — SSE 로그 스트림 타임아웃 없음

**파일:** `src/frontend/src/app/api/orchestrate/logs/route.ts:83`

```ts
intervalId = setInterval(sendLogs, 500);  // 0.5초
```

**문제:**
- orchestration이 완료되면 자동 종료하지만 (L59-73), status가 계속 "running"이면 **영원히 폴링**
- 클라이언트 비정상 종료 시 `cancel()` 호출 보장 불확실 (브라우저 탭 크래시 등)
- 최대 연결 시간 제한 없음

**수정 방향:**
- 최대 10분 타임아웃 추가
- `cancel()` 콜백에서 확실한 정리 보장

---

## 6. MEDIUM — `node-pty` 프로세스 누수

**파일:** `src/frontend/server.ts:70-133`

**문제:**
- WebSocket `close` 이벤트에서만 `ptyProcess.kill()` 호출 (L127)
- TCP 커넥션이 끊기지 않은 채 행인 경우 (좀비 연결) PTY 프로세스 누적
- 터미널 페이지를 열었다 닫기를 반복하면 PTY 프로세스 잔존 가능

**수정 방향:**
- idle timeout 추가 (마지막 데이터 전송 후 5분 경과 시 자동 종료)
- `ptyProcess.onExit`에서 WebSocket도 확실히 닫기

---

## 7. LOW — API 라우트 파일 파싱 무캐싱

**파일:**
- `src/frontend/src/lib/parser.ts` — `parseAllTasks()`
- `src/frontend/src/lib/doc-tree.ts`
- `src/frontend/src/lib/notice-parser.ts`

**문제:**
- 매 API 호출마다 TASKS_DIR 전체 스캔 + 마크다운 파싱
- 위의 폴링들과 결합되면 초당 수회 디스크 I/O

**수정 방향:**
- 메모리 캐시 + TTL (1~3초) 적용
- 또는 tasks/watch의 fs.watch 이벤트로 캐시 무효화

---

## 요약 — 우선순위별 수정 순서

| 순위 | 대상 | 예상 효과 | 난이도 |
|------|------|----------|--------|
| 1 | useMonitor refetchInterval 상향 + execSync 최적화 | 메모리/CPU 즉시 80%+ 감소 | 낮음 |
| 2 | orchestrationStore/tasksStore 모듈 자동시작 제거 | 중복 폴링 제거 | 낮음 |
| 3 | tasks/[id] 중복 interval 제거 | 불필요 API 호출 제거 | 낮음 |
| 4 | SSE 재연결 backoff + 타임아웃 | 에러 시 무한루프 방지 | 중간 |
| 5 | node-pty idle timeout | 좀비 프로세스 방지 | 중간 |
| 6 | 파일 파싱 캐싱 | 디스크 I/O 감소 | 중간 |

**1~3번만 수정해도 서비스 안정화 가능.** 특히 1번(useMonitor)이 가장 치명적 — 다른 이슈 없이도 이것만으로 OOM 발생 가능.
