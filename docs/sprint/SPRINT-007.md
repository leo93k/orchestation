---
status: ready
---

# Sprint 7: 웹 기반 오케스트레이션 실행

## 목표

- 대시보드 웹 UI에서 직접 오케스트레이션을 실행하고 모니터링할 수 있도록 한다
- Sprint/Task를 웹에서 생성하고, 실행 버튼으로 orchestrate.sh를 트리거한다
- 실행 상태를 실시간으로 확인하고, 완료 시 결과를 대시보드에 반영한다

## 포함 Task

### 배치 0 (독립)
- TASK-031: Sprint/Task 생성 API — 웹에서 Sprint, Task 문서를 생성/수정하는 API
- TASK-032: 오케스트레이션 실행 API — orchestrate.sh를 웹에서 트리거하는 API + 실행 상태 관리

### 배치 1 (배치 0 완료 후)
- TASK-033: Sprint/Task 생성 UI — 웹에서 Sprint 정의, Task 추가/편집 폼
- TASK-034: 오케스트레이션 실행 UI — 실행 버튼, 실시간 진행 상태, 로그 스트리밍

### 배치 2 (배치 1 완료 후)
- TASK-035: 실행 결과 통합 — 실행 완료 후 Task 상태 자동 갱신, 비용 로그 반영, 대시보드 새로고침
