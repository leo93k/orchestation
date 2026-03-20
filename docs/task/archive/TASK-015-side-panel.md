---
id: TASK-015
title: Task 클릭 사이드 패널
sprint: SPRINT-002
status: done
priority: high
depends_on:
  - TASK-012
blocks:
  - TASK-016
parallel_with:
  - TASK-016
role: frontend-dev
branch: task/TASK-015-side-panel
worktree: ../repo-wt-TASK-015
reviewer_role: reviewer-general
affected_files:
  - src/frontend/components/waterfall/TaskDetailPanel.tsx
---

## 목표

Task 바 클릭 시 오른쪽에 사이드 패널로 Task 상세 정보를 표시한다.

## 무엇을

- `src/frontend/components/waterfall/TaskDetailPanel.tsx`

## 어떻게

- **shadcn/ui Sheet** 컴포넌트 활용 (오른쪽 슬라이드 패널)
- 표시 항목:
  - Task ID, title
  - status (색상 뱃지)
  - priority (뱃지)
  - role
  - sprint
  - depends_on (Task ID 목록)
  - blocks (Task ID 목록)
  - parallel_with (Task ID 목록)
  - affected_files
- 패널 외부 클릭 또는 X 버튼으로 닫기

## 입출력

- 입력: `WaterfallTask | null` (null이면 패널 닫힘)
- 출력: 사이드 패널 UI

## 완료 조건

- Task 바 클릭 시 사이드 패널이 열림
- 모든 Task 정보가 정확히 표시됨
- 패널 닫기가 정상 동작
