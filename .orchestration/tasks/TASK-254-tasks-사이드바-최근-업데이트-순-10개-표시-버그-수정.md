---
id: TASK-254
title: Tasks 사이드바 최근 업데이트 순 10개 표시 버그 수정
status: done
branch: task/task-254
worktree: ../repo-wt-task-254
priority: high
scope:
  - src/frontend/src/components/**
  - src/frontend/src/store/**
  - src/frontend/src/lib/**
  - src/frontend/src/app/api/tasks/**
created: 2026-03-27
updated: 2026-03-27
---
sidebar.tsx에서 현재 status weight 기반 정렬 후 slice(0,15)로 자르고 status별로 나눠 렌더링하는 구조 때문에 실제로 2개만 보이는 버그가 있음. updated 기준 최신순으로 정렬하여 상위 10개를 표시하도록 수정. status별 섹션 분리 대신 단순 리스트로 최근 10개를 보여주거나, 정렬 기준을 updated desc로 바꾸고 limit을 10으로 변경해야 함.

## Completion Criteria
- 사이드바 Tasks 섹션에 최근 업데이트된 순서대로 최대 10개 태스크가 표시됨
- 2개 이하로 표시되는 버그가 재현되지 않음
- updated 필드 기준 내림차순 정렬이 올바르게 동작함
- 모든 status(in_progress, pending, done 등)의 태스크가 최신순으로 포함됨
