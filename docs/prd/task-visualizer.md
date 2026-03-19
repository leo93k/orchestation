# PRD: 오케스트레이션 대시보드

## 목표

`docs/` 하위 문서(task, sprint, plan)를 파싱하여 프로젝트 현황을 웹 대시보드로 시각화한다.

## 핵심 기능

### 1단계: Task 관계도 (현재 스코프)

- `docs/task/*.md`의 YAML frontmatter를 파싱
- Task 간 관계(`depends_on`, `blocks`, `parallel_with`)를 그래프로 시각화
- Task 상태(`backlog`, `in_progress`, `in_review`, `done`)를 색상으로 구분
- Task 정보(id, title, priority, role 등)를 노드에 표시

### 2단계: Sprint 뷰 (향후)

- Sprint별 Task 그룹핑
- Sprint 진행률 표시

### 3단계: Plan 뷰 (향후)

- Plan → Sprint → Task 전체 흐름 조감도

## 기술 스택

- **프레임워크**: Next.js
- **데이터 소스**: `docs/task/*.md` frontmatter 직접 파싱 (별도 DB 없음)
- **배포**: 로컬 실행

## 데이터 흐름

```
docs/task/*.md → Next.js API Route (frontmatter 파싱) → 프론트엔드 (그래프 렌더링)
```

## UI 구조

- **대시보드 레이아웃**: 사이드바(네비게이션) + 메인 영역
- **네비게이션**: Task / Sprint(향후) / Plan(향후) 탭 전환
- **1단계에서는 Task 뷰만 구현**, 나머지는 탭 자리만 잡아둠

## 시각화 요구사항

- Task = 노드
- 관계(`depends_on`, `blocks`, `parallel_with`) = 엣지
- 상태별 색상 구분
- 노드 클릭 시 Task 상세 정보 표시

## 완료 조건

- 로컬에서 Next.js 앱 실행 시 Task 관계도가 정상 렌더링된다
- `docs/task/`에 파일을 추가/수정하면 새로고침 시 반영된다
- 상태별 색상이 구분된다
