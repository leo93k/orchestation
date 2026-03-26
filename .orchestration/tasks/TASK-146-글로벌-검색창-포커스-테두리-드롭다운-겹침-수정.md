---
id: TASK-146
title: 글로벌 검색창 포커스 테두리 + 드롭다운 겹침 수정
status: done
branch: task/task-146
worktree: ../repo-wt-task-146
priority: medium
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/globals.css
  - src/frontend/src/components/GlobalSearch.tsx
---

## 현상
- 검색창 포커스 시 파란색 테두리가 드롭다운(검색 결과)과 겹쳐서 하단 테두리가 잘려 보임
- .global-search.search-open에서 border-radius를 상단만 주고 있는데 테두리 자체가 겹침

## 수정 방향
- 검색창 열릴 때 하단 border 제거하고 드롭다운 상단과 자연스럽게 연결
- 또는 드롭다운에 z-index 조정하여 겹침 방지

## Completion Criteria
- 검색창 포커스 + 드롭다운 열림 시 테두리가 깔끔하게 표시
