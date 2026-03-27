---
id: TASK-271
title: cost-parser.ts 정규식 매치 결과 타입 안전성 보강
status: in_progress
branch: task/task-271
worktree: ../repo-wt-task-271
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

Good. `cost-parser.ts` has 5 type errors on lines 56-60 where regex match group results (`string | undefined`) are assigned to `string` fields in `CostEntry`. This is a clean, contained fix.

---
id: TASK-271
title: cost-parser.ts 정규식 매치 결과 타입 안전성 보강
status: in_progress
branch: task/task-271
worktree: ../repo-wt-task-271
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---
`parseCostLogLine` 함수에서 regex match 결과(`matchWithModel[1]` ~ `matchWithModel[5]`)를 `CostEntry`의 `string` 필드에 직접 대입하고 있으나, `RegExpMatchArray` 인덱스 접근은 `string | undefined`를 반환하므로 strict 모드(`noUncheckedIndexedAccess`)에서 타입 오류 발생.

Lines 56-60에서 `matchWithModel[1]`~`matchWithModel[4]`를 `string` 필드(`timestamp`, `taskId`, `phase`, `model`)에 대입 시, 그리고 `parseInt`/`parseFloat`에 전달 시 `string | undefined` → `string` 불일치.

**수정 방법**: non-null assertion(`!`) 또는 fallback(`?? ""`)을 추가하여 타입을 좁힌다. regex가 매치된 직후이므로 캡처 그룹은 반드시 존재하며, `!` 사용이 적절.

## Completion Criteria
- `npx tsc --noEmit --noUncheckedIndexedAccess` 실행 시 `cost-parser.ts` 관련 오류 0건
- 기존 로직 변경 없음 (타입 단언만 추가)

## Completion Criteria


