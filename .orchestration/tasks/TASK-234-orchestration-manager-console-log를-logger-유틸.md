---
id: TASK-234
title: orchestration-manager console.log를 logger 유틸로 교체
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/orchestration-manager.ts
---
`orchestration-manager.ts`의 `cleanupZombies()` 메서드에 `console.log` / `console.warn`이 5건 남아 있음 (no-console 위반).

- L367: `console.log(`[orchestrate] ${taskId}: PID 파일 없으나 …`)`
- L375: `console.log(`[orchestrate] zombie cleanup: …`)`
- L379: `console.log(`[orchestrate] ${cleaned}개 좀비 …`)`
- L391: `console.log("[orchestrate] stale lock 제거")`
- L396: `console.warn("[orchestrate] zombie cleanup error:", …)`

프로젝트에 이미 존재하는 로깅 패턴(또는 간단한 `debug` 레벨 logger)으로 교체하거나, 불필요한 로그는 삭제한다.

## Completion Criteria
- `orchestration-manager.ts` 내 `console.log` / `console.warn` 0건
- 기존 로직 변경 없음 (로그 출력 방식만 변경)
- 빌드(`npm run build`) 성공
