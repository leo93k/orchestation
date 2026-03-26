---
id: TASK-239
title: DAGCanvas non-null assertion 타입 안전성 수정
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope: []
---
Line 283에서 `layout.topGroups.map`으로 모든 그룹을 순회하면서 285-286에서 `g.box!`를 사용합니다. 그런데 `computeGroup`은 `null`을 반환할 수 있으므로, `g.box`가 `null`인 경우 런타임 에러가 발생합니다. 이것은 non-null assertion(`!`)으로 타입 오류를 숨긴 실제 타입 안전성 문제입니다.

렌더링 시 `g.box`가 null인 그룹을 필터링해야 합니다.

---
id: TASK-239
title: DAGCanvas non-null assertion 타입 안전성 수정
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
---
`DAGCanvas.tsx` 285-286행에서 `g.box!`로 non-null assertion을 사용하지만, `computeGroup()`은 매칭 섹션이 없으면 `null`을 반환한다. 빈 그룹일 때 런타임 에러가 발생할 수 있다.

수정: `layout.topGroups.map` 앞에 `.filter((g) => g.box !== null)`을 추가하거나, JSX 내에서 `g.box &&` 가드를 사용하여 non-null assertion(`!`)을 제거한다.

## Completion Criteria
- `g.box!` non-null assertion 제거
- `g.box`가 `null`인 경우를 안전하게 처리 (filter 또는 조건부 렌더링)
- `npx tsc --noEmit --strict` 통과 확인
