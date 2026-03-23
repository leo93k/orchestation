---
status: ready
---

# Sprint 8: 실시간 모니터링 + 알림

## 목표

오케스트레이션이 돌아가는 동안 사용자가 "지금 뭐 하고 있는지"를 대시보드에서 **물어보지 않아도** 알 수 있어야 한다.

## 핵심 문제

현재는 오케스트레이션 실행 중에:
- 어떤 Task가 실행 중인지 알려면 파일을 직접 확인해야 함
- 완료/실패 시 알림이 없음 → 계속 새로고침하거나 물어봐야 함
- Task 상세를 보려면 사이드 패널만 있음 → 실행 로그는 볼 수 없음
- "멈춘 건지 돌고 있는 건지" 구분할 수 없음

## 해결해야 할 것

### 1. 실시간 상태 자동 갱신
- 대시보드 홈의 Overview 카드, Active Tasks, Active Sprints가 주기적으로 자동 갱신 (5초 polling)
- Task 상태 변경 시 (backlog → in_progress → done) UI가 즉시 반영
- 스피너가 돌고 있으면 "살아있다", 멈추면 "끝났다"가 직관적으로 보여야 함

### 2. 토스트 알림
- Task 완료 시: "✅ TASK-031 완료" 토스트 (우하단, 3초 후 자동 닫힘)
- Task 실패 시: "❌ TASK-031 실패" 토스트 (빨간색, 수동 닫기)
- Sprint 전체 완료 시: "🎉 Sprint 7 완료!" 토스트
- 새 Task 실행 시작 시: "🚀 TASK-033 실행 시작" 토스트

### 3. Task 상세 페이지 (/tasks/[id])
- 현재: 우측 사이드 패널에서만 간단한 정보 표시
- 개선: 별도 페이지로 이동 가능
  - Task 메타 정보 (상태, 우선순위, 역할, 의존성, Sprint)
  - Task 문서 내용 (docs/task/TASK-XXX.md의 body)
  - 실행 로그 (output/TASK-XXX-task.json의 result)
  - 리뷰 결과 (output/TASK-XXX-review.json의 result)
  - 비용 정보 (token-usage.log에서 해당 Task)
  - 실행 중이면 로그가 실시간으로 업데이트

### 4. /tasks 리스트에서도 실시간 표시
- In Progress 태스크에 스피너 표시 (홈과 동일)
- 상태 변경 시 자동 갱신

### 5. 홈 대시보드 개선
- "마지막 갱신: 3초 전" 타임스탬프 표시
- 실행 중일 때 전체 페이지 상단에 파란 인디케이터 바 (GitHub Actions 스타일)
- **Active Sprints + Active Tasks 통합**: Active Sprint 아래에 해당 Sprint의 Task 목록을 인라인으로 표시
  - 완료된 Task: ✅ 체크 표시
  - 진행 중 Task: 🔄 스피너
  - 대기 중 Task: ○ 빈 원
  - "Active Sprints"와 "Active Tasks" 섹션을 하나로 합침

### 6. 레이아웃 개선
- 콘텐츠 영역 max-width 제한 (현재 너무 넓게 퍼짐)
- 좌우로 길게 늘어나지 않도록 중앙 정렬 + 적절한 max-width
- 홈, Sprint, Cost 등 모든 페이지에 일관 적용

### 7. 웹 기반 실행 제어

현재 문제:
- auto-improve.sh는 터미널에서만 실행 가능
- orchestrate.sh도 터미널에서만 실행 가능
- 웹에서 "지금 돌고 있는지" 확인 불가

해결:
- **홈 또는 상단에 실행 컨트롤 바** 배치
  - "▶ Auto-Improve 시작" 버튼 → 백그라운드로 auto-improve.sh 실행
  - "⏸ 일시정지" → 현재 request 처리 후 대기
  - "⏹ 중지" → 현재 orchestrate 완료 후 중지
  - 실행 상태 표시: "🔄 REQ-004 처리 중 (3/7)" 또는 "⏸ 대기 중" 또는 "⏹ 중지됨"
- **Request 페이지에서 개별 실행**
  - 각 request 카드에 "▶ 지금 실행" 버튼 → 해당 request만 즉시 처리
  - auto-improve가 꺼져 있어도 단건 실행 가능
- **Sprint 실행도 Request로 통합**
  - Sprint 상세 페이지에 "▶ 이 Sprint 실행" 버튼
  - 클릭 시 자동으로 "Sprint X에 있는 backlog 태스크를 실행해줘" request 생성
  - auto-improve가 해당 request를 처리
- **실행 큐 표시**
  - Requests 페이지 상단에 "현재 처리 중: REQ-004" + "대기 중: REQ-005, 006, 007"
  - 순서 변경 가능 (드래그 또는 우선순위 변경)
