---
id: TASK-253
title: Tasks 사이드바 최근 업데이트 순 10개 표시 버그 수정
status: in_progress
branch: task/task-253
worktree: ../repo-wt-task-253
priority: high
scope:
  - src/frontend/src/lib/**
  - src/frontend/src/components/**
  - src/frontend/src/stores/**
  - scripts/**
created: 2026-03-27
updated: 2026-03-27
---
사이드바에 최근 updatedAt 기준 상위 10개 task가 표시되어야 하는데 2개만 나오는 버그를 수정한다. task 목록 조회 로직(필터링/정렬/슬라이싱)을 점검하고, updatedAt 내림차순 정렬 후 상위 10개를 올바르게 반환하도록 수정한다.

## Completion Criteria
- 사이드바에 최근 updatedAt 순으로 정렬된 task가 최대 10개 표시된다
- task가 10개 미만인 경우 존재하는 모든 task가 표시된다
- 정렬 기준이 updatedAt 내림차순임이 확인된다
