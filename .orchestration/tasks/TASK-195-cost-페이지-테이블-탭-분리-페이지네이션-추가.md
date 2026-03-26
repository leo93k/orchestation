---
id: TASK-195
title: Cost 페이지 테이블 탭 분리 + 페이지네이션 추가
status: done
branch: task/task-195
worktree: ../repo-wt-task-195
priority: medium
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/cost/page.tsx
  - src/frontend/src/components/cost/CostTable.tsx
---

## 현상
- Cost 페이지에 테이블이 2개 (비용 테이블 + 실행 이력) 한 화면에 나열
- 페이지네이션 없이 전체 데이터 표시

## 수정 방향
- 2개 테이블을 탭으로 분리 (비용 | 실행 이력)
- 각 테이블에 페이지네이션 추가 (10/20/50개씩)
- 탭 스타일은 tasks 페이지와 동일 (border-b-2)

## Completion Criteria
- 탭 2개로 분리
- 각 탭에 페이지네이션 동작
- 기존 정렬/필터 유지
