---
id: TASK-290
title: cost-parser.ts 중복 PROJECT_ROOT 선언을 공용 paths 모듈로 교체
status: rejected
branch: task/task-290
worktree: ../repo-wt-task-290
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:  []
---

Now output in the exact format requested:

---
id: TASK-290
title: cost-parser.ts 중복 PROJECT_ROOT 선언을 공용 paths 모듈로 교체
status: rejected
branch: task/task-290
worktree: ../repo-wt-task-290
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---
`src/frontend/src/lib/cost-parser.ts:45`에서 `PROJECT_ROOT`를 `path.join(process.cwd(), "../..")`로 자체 선언하고 있으나, 프로젝트 공용 `src/frontend/src/lib/paths.ts`에 이미 `path.resolve` 기반 `PROJECT_ROOT`가 존재한다. 중복 선언이며 `path.join` vs `path.resolve` 미세 불일치 가능성이 있다.

## Completion Criteria
- cost-parser.ts의 로컬 PROJECT_ROOT 선언을 제거하고 `@/lib/paths`에서 import하도록 교체
- 기존 parseCostLog 동작에 영향 없음 확인

## Completion Criteria


