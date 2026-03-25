# Magic Number Audit — API Routes & Hooks

> 작성일: 2026-03-25
> 대상 범위: `src/frontend/src/app/api/**`, `src/frontend/src/hooks/**`, `src/frontend/src/app/night-worker/page.tsx`, `src/frontend/src/components/TaskLogModal.tsx`, `src/frontend/src/components/AutoImproveControl.tsx`

---

## 1. 파일별 매직 넘버 전수 목록

### 1-1. `src/frontend/src/app/api/chat/route.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 5 | `120` | `maxDuration` — Next.js 서버리스 함수 최대 실행 시간 (초) | analyze/route.ts 와 동일 |
| 35 | `10` | `history.slice(-10)` — 대화 히스토리 최대 전달 건수 | |
| 115 | `90000` | Claude CLI spawn 타임아웃 (ms, 90초) | analyze/route.ts 와 동일 |

---

### 1-2. `src/frontend/src/app/api/tasks/watch/route.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 33 | `100` | 파일 변경 감지 디바운스 (ms) | 서버 측 |
| 40 | `30000` | SSE keep-alive ping 전송 간격 (ms, 30초) | |
| 51 | `5 * 60 * 1000` (`300000`) | SSE 스트림 자동 종료 타임아웃 (ms, 5분) | 표현식으로 의도는 명확하나 상수화 권장 |

---

### 1-3. `src/frontend/src/app/api/tasks/analyze/route.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 5 | `120` | `maxDuration` — Next.js 서버리스 함수 최대 실행 시간 (초) | chat/route.ts 와 동일 |
| 190 | `90000` | Claude CLI spawn 타임아웃 (ms, 90초) | chat/route.ts 와 동일 |

---

### 1-4. `src/frontend/src/app/api/monitor/route.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 24 | `3000` | `execSync` 타임아웃 (ms) — `getClaudeProcesses()` 내부 `ps aux` 실행 | 3곳 동일 값 반복 |
| 106 | `3000` | `execSync` 타임아웃 (ms) — `getProcessCount()` 내부 `ps -A` 실행 | |
| 115 | `3000` | `execSync` 타임아웃 (ms) — `getThreadCount()` 내부 `ps -M -A` 실행 | |
| 51 | `0.05` | 의미있는 프로세스 필터 임계값 (메모리 %) | |

---

### 1-5. `src/frontend/src/app/api/night-worker/route.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 39 | `200` | 로그 파일에서 읽을 최근 줄 수 (`slice(-200)`) | |
| 61 | `10` | `maxTasks` 기본값 (destructuring default) | |

---

### 1-6. `src/frontend/src/hooks/useTasks.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 78 | `1000` | SSE `changed` 이벤트 클라이언트 측 디바운스 (ms) | useRequests.ts 와 동일 |
| 88 | `2000` | SSE 오류 시 재연결 대기 시간 (ms) | useRequests.ts 와 동일 |

---

### 1-7. `src/frontend/src/hooks/useRequests.ts`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 77 | `1000` | SSE `changed` 이벤트 클라이언트 측 디바운스 (ms) | useTasks.ts 와 동일 |
| 87 | `2000` | SSE 오류 시 재연결 대기 시간 (ms) | useTasks.ts 와 동일 |

---

### 1-8. `src/frontend/src/app/night-worker/page.tsx`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 45 | `3000` | Night Worker 상태 폴링 간격 (ms) | AutoImproveControl.tsx 는 2000ms |
| 290 | `80` | 추가 지시 문자열 미리보기 최대 길이 (chars) | |

---

### 1-9. `src/frontend/src/components/TaskLogModal.tsx`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 57 | `3000` | `in_progress` 상태 시 로그 폴링 간격 (ms) | night-worker/page.tsx 와 동일 |
| 73 | `40` | 스크롤 바닥 감지 임계값 (px) | |

---

### 1-10. `src/frontend/src/components/AutoImproveControl.tsx`

| 라인 | 값 | 용도 | 비고 |
|------|-----|------|------|
| 41 | `2000` | orchestrate 상태 폴링 간격 (ms) | night-worker/page.tsx·TaskLogModal.tsx 는 3000ms |

---

## 2. 불일치 사례 (동일 목적, 다른 값)

### 2-1. 폴링 간격 — 3000ms vs 2000ms

| 파일 | 라인 | 값 | 설명 |
|------|------|-----|------|
| `night-worker/page.tsx` | 45 | `3000` | Night Worker 상태 폴링 |
| `TaskLogModal.tsx` | 57 | `3000` | 태스크 로그 폴링 |
| `AutoImproveControl.tsx` | 41 | `2000` | Orchestrate 상태 폴링 |

`AutoImproveControl`만 2000ms로 다르다. 세 컴포넌트가 모두 "실행 중인 프로세스 상태를 주기적으로 갱신"하는 동일한 목적임에도 값이 다르다. 잦은 폴링은 불필요한 API 호출을 유발한다.

---

### 2-2. 디바운스 — 서버 100ms vs 클라이언트 1000ms

| 파일 | 라인 | 값 | 설명 |
|------|------|-----|------|
| `api/tasks/watch/route.ts` | 33 | `100` | 서버: 파일 변경 SSE 이벤트 디바운스 |
| `hooks/useTasks.ts` | 78 | `1000` | 클라이언트: SSE changed 수신 후 refetch 디바운스 |
| `hooks/useRequests.ts` | 77 | `1000` | 클라이언트: SSE changed 수신 후 refetch 디바운스 |

서버가 100ms 디바운스로 이벤트를 압축해서 전송하고, 클라이언트가 다시 1000ms 디바운스를 적용한다. **이중 디바운스** 구조이다. 의도적인 설계라면 주석으로 명시해야 하고, 아니라면 한 계층에서만 디바운스하도록 정리해야 한다.

---

### 2-3. SSE 재연결 대기 — 중복 (일치하나 분산)

| 파일 | 라인 | 값 | 설명 |
|------|------|-----|------|
| `hooks/useTasks.ts` | 88 | `2000` | SSE 재연결 대기 |
| `hooks/useRequests.ts` | 87 | `2000` | SSE 재연결 대기 |

값은 같지만 두 파일에 중복 정의되어 있다. 하나의 상수로 공유되어야 한다.

---

### 2-4. `execSync` 타임아웃 — 동일 값 3중 반복

| 파일 | 라인 | 값 | 설명 |
|------|------|-----|------|
| `api/monitor/route.ts` | 24 | `3000` | `getClaudeProcesses` |
| `api/monitor/route.ts` | 106 | `3000` | `getProcessCount` |
| `api/monitor/route.ts` | 115 | `3000` | `getThreadCount` |

같은 파일 내에서 동일한 의미의 값이 3번 반복된다. 파일 상단 상수로 추출하면 즉시 해소된다.

---

## 3. 상수 추출 권장 구조

### 제안: `src/frontend/src/config/timeouts.ts`

```typescript
/**
 * 전역 타임아웃 / 인터벌 / 한도 상수
 *
 * 값 변경 시 이 파일만 수정하면 된다.
 */

// ── Claude CLI ──────────────────────────────────────────────
/** Claude CLI spawn 프로세스 타임아웃 (ms) */
export const CLAUDE_CLI_TIMEOUT_MS = 90_000;

/** Next.js 서버리스 함수 최대 실행 시간 (초) — maxDuration 에 직접 할당 불가, 참조용 */
export const ROUTE_MAX_DURATION_SEC = 120;

// ── SSE / Watch ─────────────────────────────────────────────
/** 서버: 파일 변경 감지 후 SSE 이벤트 디바운스 (ms) */
export const SSE_SERVER_DEBOUNCE_MS = 100;

/** 서버: SSE 스트림 자동 종료 타임아웃 (ms, 클라이언트 재연결 유도) */
export const SSE_AUTO_CLOSE_MS = 5 * 60 * 1000; // 5분

/** 서버: SSE keep-alive ping 간격 (ms) */
export const SSE_KEEPALIVE_INTERVAL_MS = 30_000;

/** 클라이언트: SSE changed 이벤트 수신 후 refetch 디바운스 (ms) */
export const SSE_CLIENT_DEBOUNCE_MS = 1_000;

/** 클라이언트: SSE 오류 시 재연결 대기 (ms) */
export const SSE_RECONNECT_DELAY_MS = 2_000;

// ── 폴링 간격 ────────────────────────────────────────────────
/** 상태/로그 폴링 기본 간격 (ms) — TaskLogModal, NightWorkerPage */
export const STATUS_POLL_INTERVAL_MS = 3_000;

/** Orchestrate 상태 폴링 간격 (ms) — AutoImproveControl */
export const ORCHESTRATE_POLL_INTERVAL_MS = 3_000; // 현재 2000, 3000 으로 통일 권장

// ── 시스템 모니터 ─────────────────────────────────────────────
/** execSync 타임아웃 (ms) — monitor/route.ts ps 명령 */
export const EXEC_SYNC_TIMEOUT_MS = 3_000;

/** 의미있는 프로세스 메모리 최소 임계값 (%) */
export const PROCESS_MEM_THRESHOLD_PCT = 0.05;

// ── 로그 / 문자열 ─────────────────────────────────────────────
/** Night Worker 로그 최대 보관 줄 수 */
export const NIGHT_WORKER_LOG_MAX_LINES = 200;

/** 추가 지시 미리보기 최대 길이 (chars) */
export const INSTRUCTIONS_PREVIEW_MAX_CHARS = 80;

// ── 대화 히스토리 ─────────────────────────────────────────────
/** chat/route.ts 에서 Claude CLI 에 전달할 히스토리 최대 건수 */
export const CHAT_HISTORY_MAX_ITEMS = 10;
```

### 사용 예시

```typescript
// Before
const timeout = setTimeout(() => { child.kill("SIGTERM"); }, 90000);

// After
import { CLAUDE_CLI_TIMEOUT_MS } from "@/config/timeouts";
const timeout = setTimeout(() => { child.kill("SIGTERM"); }, CLAUDE_CLI_TIMEOUT_MS);
```

---

## 4. 우선순위별 개선 권고

### 🔴 High — 즉시 수정 권장

| # | 파일 | 문제 | 이유 |
|---|------|------|------|
| H-1 | `api/monitor/route.ts` L24/106/115 | `3000` 3중 반복 | 같은 파일 내 단순 중복, 파일 상단 상수 1줄로 즉시 해소 가능 |
| H-2 | `AutoImproveControl.tsx` L41 vs `night-worker/page.tsx` L45, `TaskLogModal.tsx` L57 | 폴링 간격 2000 vs 3000 불일치 | 동일 목적(진행 상태 폴링)에 다른 값 → 3000ms 로 통일 권장 |

### 🟡 Medium — 단기 개선 권장

| # | 파일 | 문제 | 이유 |
|---|------|------|------|
| M-1 | `hooks/useTasks.ts` L78, `hooks/useRequests.ts` L77 | `1000` 중복 정의 | 공통 상수 1개로 추출, 향후 값 변경 시 한 곳만 수정 |
| M-2 | `hooks/useTasks.ts` L88, `hooks/useRequests.ts` L87 | `2000` 중복 정의 | 동일 SSE 재연결 로직, 공통 상수화 |
| M-3 | `api/chat/route.ts` L5/115, `api/tasks/analyze/route.ts` L5/190 | `120`, `90000` 양 파일에 중복 | 공통 config 로 추출하면 두 route 가 일관성 유지 |
| M-4 | `api/tasks/watch/route.ts` L33/40/51 | `100`, `30000`, `5*60*1000` | SSE 관련 상수 3개, 의미가 불분명한 숫자 리터럴 |

### 🟢 Low — 중장기 관리

| # | 파일 | 문제 | 이유 |
|---|------|------|------|
| L-1 | `api/night-worker/route.ts` L39 | `200` (log slice) | 기능 영향 낮음, 단 기획 변경 시 찾기 어려움 |
| L-2 | `night-worker/page.tsx` L290 | `80` (문자열 slice) | UI 표시용, 상수화로 디자인 일관성 확보 |
| L-3 | `TaskLogModal.tsx` L73 | `40` (스크롤 임계값 px) | 기능 영향 낮음, 주석으로 의도 명시 권장 |
| L-4 | `api/chat/route.ts` L35 | `10` (히스토리 건수) | 맥락 제한 값, 상수화로 튜닝 용이성 개선 |

---

## 요약

- 총 매직 넘버: **22건** (11개 고유 값)
- 불일치 사례: **4건** (폴링 간격, 이중 디바운스, 재연결 대기 중복, execSync 타임아웃 3중 반복)
- 소스 변경 없이 `src/frontend/src/config/timeouts.ts` 하나를 신설하고 import 치환만으로 모든 문제를 해소할 수 있다
