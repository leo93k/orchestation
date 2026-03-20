---
id: TASK-010
title: 워터폴 데이터 변환 유틸
sprint: SPRINT-002
status: done
priority: critical
depends_on: []
blocks:
  - TASK-012
  - TASK-016
parallel_with:
  - TASK-009
  - TASK-011
role: frontend-dev
branch: task/TASK-010-waterfall-data-transform
worktree: ../repo-wt-TASK-010
reviewer_role: reviewer-general
affected_files:
  - src/frontend/lib/waterfall.ts
  - src/frontend/types/
---

## 목표

API 응답(Task[], Sprint[])을 워터폴 뷰에서 사용할 트리 구조로 변환하는 유틸을 구현한다.

## 무엇을

- `src/frontend/lib/waterfall.ts` — 데이터 변환 함수
- `src/frontend/types/waterfall.ts` — 워터폴 관련 타입 정의

## 어떻게

- Sprint[] + Task[] → `WaterfallGroup[]` 트리로 변환
- 타입 구조:
```ts
type WaterfallGroup = {
  sprint: { id: string; title: string };
  tasks: WaterfallTask[];
  progress: { done: number; total: number };
};

type WaterfallTask = {
  id: string;
  title: string;
  status: "backlog" | "in_progress" | "in_review" | "done";
  priority: string;
  role: string;
  depends_on: string[];
  blocks: string[];
  parallel_with: string[];
};
```
- Sprint에 소속되지 않은 Task는 "미배정" 그룹으로 묶기

## 입출력

- 입력: `Task[]`, `Sprint[]` (API 응답)
- 출력: `WaterfallGroup[]`

## 완료 조건

- Sprint별로 Task가 정확히 그룹핑됨
- 진행률(done/total)이 정확히 계산됨
- 미배정 Task가 별도 그룹으로 처리됨
