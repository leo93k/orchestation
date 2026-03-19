---
id: TASK-012
title: 워터폴 컨테이너 + Sprint 그룹 헤더 컴포넌트
sprint: SPRINT-002
status: done
priority: critical
depends_on:
  - TASK-009
  - TASK-010
blocks:
  - TASK-015
  - TASK-016
parallel_with:
  - TASK-013
  - TASK-014
role: frontend-dev
branch: task/TASK-012-waterfall-container
worktree: ../repo-wt-TASK-012
reviewer_role: reviewer-general
affected_files:
  - src/frontend/components/waterfall/WaterfallContainer.tsx
  - src/frontend/components/waterfall/SprintHeader.tsx
---

## 목표

워터폴 뷰의 전체 컨테이너와 Sprint 그룹 헤더 컴포넌트를 구현한다.

## 무엇을

- `src/frontend/components/waterfall/WaterfallContainer.tsx` — 전체 워터폴 래퍼
- `src/frontend/components/waterfall/SprintHeader.tsx` — Sprint 그룹 헤더

## 어떻게

- **Tailwind CSS**로 직접 구현 (외부 라이브러리 없음)
- WaterfallContainer: `WaterfallGroup[]`을 받아 Sprint별로 렌더링
- SprintHeader: Sprint 이름, 진행률 표시
- shadcn/ui의 Collapsible 컴포넌트 활용 (접기/펼치기는 TASK-014에서)

## 입출력

- 입력: `WaterfallGroup[]` (TASK-010의 변환 결과)
- 출력: Sprint 헤더 + Task 바 슬롯이 있는 계층적 UI

## 완료 조건

- Sprint별로 그룹이 나뉘어 렌더링됨
- Sprint 헤더에 Sprint 이름이 표시됨
- Task 바가 들어갈 영역이 Sprint 아래에 존재
