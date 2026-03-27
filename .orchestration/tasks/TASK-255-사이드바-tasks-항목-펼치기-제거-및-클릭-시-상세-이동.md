---
id: TASK-255
title: 사이드바 Tasks 항목 펼치기 제거 및 클릭 시 상세 이동
status: done
branch: task/task-255
worktree: ../repo-wt-task-255
priority: medium
scope:
  - src/frontend/src/components/**
  - src/frontend/src/app/**
created: 2026-03-27
updated: 2026-03-27
---
사이드바 Tasks 섹션에서 아이템을 펼칠 수 있는 토글/아코디언 기능을 제거한다. 아이템 클릭 시 바로 해당 태스크 상세 페이지로 이동하도록 변경한다.

## Completion Criteria
- 사이드바 Tasks 항목에 펼치기/접기 화살표(toggle arrow)가 없다
- 항목 클릭 시 인라인 확장 없이 바로 태스크 상세 페이지로 이동한다
- 펼쳐진 상태(expanded state) 관련 코드가 완전히 제거되었다
