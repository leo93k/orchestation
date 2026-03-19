## AI CLI 역할 정의 (사람 운영용)

레오가 여러 AI CLI 터미널을 띄워 각각에 역할을 할당할 때 사용하는 가이드. 자동화된 멀티에이전트가 아니라, 사람이 수동으로 관리하는 분업 체계다.

---

## 역할 목록

### 1) 감독관

전체 방향성과 정책을 관리하는 역할.

* **하는 일**: PRD 기준 방향성 유지, 과설계 방지, 병목 발생 시 개입
* **참고 문서**: `docs/prd/`, 전체 Task 현황
* **금지**: 코드/Task/문서 직접 수정

### 2) Task 매니저

Task 생성, 분배, 진행 상태를 관리하는 역할.

* **하는 일**

  * Task 생성 및 쪼개기
  * 의존 관계(`depends_on`, `blocks`, `parallel_with`) 정의
  * 브랜치 및 Worktree 정의
  * 작업자 배정
  * 병목 및 충돌 사전 방지
  * **Task 할당 전 TBD 해소 (필수)**
    * PRD나 기획에 TBD·미정·불명확한 항목이 있으면, **절대 가정하거나 임의로 결정하지 않는다**
    * 반드시 레오에게 질문하여 명확한 답변을 받은 뒤 Task에 반영한다
    * Task 내용은 **작업자(agent)가 추가 판단 없이 바로 실행할 수 있을 정도로 구체적**이어야 한다
    * 다음 항목이 모두 명시되어야 Task를 배정할 수 있다:
      * **무엇을**: 수정/생성할 파일, 함수, 컴포넌트 이름
      * **어떻게**: 구현 방식, 사용할 라이브러리/패턴, 데이터 구조
      * **입출력**: 예상 input/output 예시 또는 스펙
      * **완료 조건**: 어떤 상태가 되면 이 Task가 끝난 것인지 (테스트 통과 기준 포함)
    * "적절히 구현", "알아서 판단" 같은 모호한 표현 금지 — 작업자가 해석할 여지를 남기지 않는다
* **참고 문서**: `docs/current/`, `docs/task/`
* **산출물**: Task 파일 생성 및 상태 관리
* **금지**: 코드 수정

### 3) 작업자

Task를 받아 실제 코드 작업을 수행하는 역할.

* **하는 일**

  * Worktree에서 코드 수정
  * 테스트 작성 및 실행
  * Reviewer 피드백 반영
* **참고 문서**: `docs/task/`
* **산출물**: 코드, 테스트
* **금지**

  * `main` 브랜치 직접 수정 금지
  * Task 상태 완료 처리 금지

### 4) Reviewer (검증자)

작업 결과를 검증하고 승인하는 역할.

* **하는 일**

  * 코드 리뷰
  * 테스트 검증
  * 승인 또는 수정 요청
* **참고 문서**: Task 파일, 코드
* **완료 처리**: 승인 시 Task 완료 상태 변경
* **금지**: 코드 직접 수정

### 5) Writer (문서화 담당)

모든 변경사항을 공식 문서로 반영하는 역할.

* **하는 일**

  * Task 결과 기반 문서 업데이트
  * `docs/current/` 최신 상태 유지
* **참고 문서**: 코드, Task 파일
* **산출물**: 문서
* **금지**

  * 코드 수정 금지
  * Task 상태 변경 금지

---

## 역할 간 흐름

```
감독관
  ↓
Task 매니저 → Task 생성 및 의존 관계 정의
  ↓
작업자 → Worktree에서 코드 작업 (parallel_with Task는 동시 실행)
  ↓
Reviewer → 코드 리뷰 및 승인
  ↓
Writer → 문서 업데이트
  ↓
blocked Task 해제 → 다음 Task 시작
```

---

## Task 관리

### 1) 폴더 구조

Task 파일은 플랫하게 관리한다. 순서와 병렬 관계는 frontmatter로 표현한다.

```
docs/task/
├── TASK-001-data-model.md
├── TASK-002-api-crud.md
├── TASK-003-api-filter.md
├── TASK-004-ui-list.md
├── TASK-005-ui-detail.md
└── TASK-006-ui-admin.md
```

### 2) Task 파일 형식

모든 Task 파일은 YAML frontmatter를 포함한다.

```yaml
---
id: TASK-XXX
title: 작업 제목
status: backlog          # backlog → in_progress → in_review → done
priority: critical       # critical / high / medium / low
depends_on:              # 이 Task가 시작되려면 완료되어야 하는 Task
  - TASK-001
blocks:                  # 이 Task가 완료되어야 시작할 수 있는 Task
  - TASK-003
parallel_with:           # 동시 실행 가능한 Task (영향 파일 분리 전제)
  - TASK-004
owner: worker-a          # 배정된 작업자
branch: task/TASK-XXX-short-desc
worktree: ../repo-wt-TASK-XXX
reviewer: reviewer-1
affected_files:          # 이 Task가 수정하는 파일/디렉토리
  - src/models/
  - src/types/
---
```

### 3) frontmatter 필드 설명

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자. 전체 프로젝트에서 순차 증가 |
| `status` | `backlog` → `in_progress` → `in_review` → `done` |
| `depends_on` | 선행 Task 목록. 모두 `done`이어야 시작 가능 |
| `blocks` | 이 Task가 완료되어야 해제되는 후행 Task 목록 |
| `parallel_with` | 동시 실행 가능한 Task. `affected_files`가 겹치지 않아야 함 |
| `affected_files` | 수정 대상 파일/디렉토리. 충돌 방지의 근거 |

### 4) 실행 규칙

* `depends_on`의 모든 Task가 `done`이면 시작 가능
* `parallel_with`에 명시된 Task끼리는 동시 실행 허용
* `parallel_with` Task 간 `affected_files`가 겹치면 Task 매니저가 조정
* `blocks`는 `depends_on`의 역방향 참조 (양쪽 모두 명시하여 일관성 유지)

### 5) 상태 변경 권한

| 전환 | 권한 |
|------|------|
| `backlog` → `in_progress` | Task 매니저 |
| `in_progress` → `in_review` | 작업자 |
| `in_review` → `done` | Reviewer |
| `in_review` → `in_progress` | Reviewer (수정 요청 시) |

---

## 운영 규칙

### 1) Worktree 규칙

* 작업자는 반드시 **자신의 Worktree에서만** 작업
* 다른 Worktree 접근 금지
* 동일 파일을 여러 Task에서 동시에 수정 금지 (Task 매니저 책임)

### 2) 브랜치 규칙

* 모든 작업은 `task/*` 브랜치에서 수행
* `main` 브랜치 직접 수정 금지
* merge는 Reviewer 승인 후만 가능

### 3) 문서 규칙

* 공용 문서(`docs/current/`)는 Writer만 수정
* 작업자는 Task 파일만 수정 가능
* Task 파일은 단일 진실 소스(SSOT)

### 4) 충돌 방지 규칙

* `parallel_with` Task 간 `affected_files`가 겹치면 안 됨 (Task 매니저가 사전 검증)
* 동일 영역 작업은 `depends_on`으로 순차 처리
* 충돌 발생 시 작업자가 아닌 Task 매니저가 조정

### 5) Escalation 규칙

다음 조건 발생 시 감독관 개입:

* 2회 이상 Reviewer 피드백 무응답
* 24시간 이상 작업 미진행
* 3일 이상 Task 미완료
* 반복적인 설계 충돌 발생

### 6) 병렬 작업 규칙

* 병렬 실행은 `parallel_with`에 명시된 Task 간에만 허용
* 한 Task = 한 브랜치 = 한 Worktree
* 각 작업자는 **서로 다른 Worktree**에서만 작업 (동일 디렉토리 공유 금지)
* `affected_files` 겹침 금지
* Reviewer는 **Task별로 독립 리뷰** 수행 (리뷰 혼합 금지)
* Writer는 **`done` 상태 Task만** 순차적으로 문서 반영 (공용 문서 동시 수정 금지)
* 병렬 중 충돌 징후 발생 시 **Task 매니저가 즉시 조정/재배정**

### 7) 브랜치 전략

* 기본 브랜치: `main` (항상 배포 가능한 상태 유지)
* 작업 브랜치: `task/TASK-XXX-<short-desc>`
* (선택) 검증 브랜치: `review/TASK-XXX-<short-desc>`
* (긴급) 핫픽스: `hotfix/TASK-XXX-<short-desc>`

**생성 규칙**

* Task 생성 시 Task 매니저가 브랜치/Worktree를 함께 정의
* 예: `task/TASK-101-login-form` → `../repo-wt-TASK-101`

**작업 규칙**

* 모든 개발은 `task/*` 브랜치에서만 수행
* `main` 직접 수정 금지
* 작업자는 자신의 브랜치/Worktree 외 접근 금지

**동기화 규칙**

* 장기 작업 시 주기적으로 `main`을 rebase (또는 merge)하여 최신 상태 유지
* rebase 충돌은 작업자가 해결, 설계 충돌은 Task 매니저가 조정

**머지 규칙**

* Reviewer 승인 전 merge 금지
* 기본 전략: `main`으로 **squash merge** (히스토리 단순화)
* 머지 메시지에는 반드시 `TASK-XXX` 포함

**충돌 방지 규칙**

* Task 매니저는 Task 생성 시 `affected_files`를 반드시 명시
* `affected_files`가 겹치는 Task는 `depends_on`으로 순차 처리

**정리 규칙**

* 머지 완료 후 Task 파일의 `status`를 `done`으로 변경하고 커밋
* 머지 완료 후 해당 브랜치 삭제
* Worktree 정리 (`git worktree remove`)

---

## 권한 매트릭스

### 읽기 권한

| 경로              | 감독관 | Task 매니저 | 작업자 | Reviewer | Writer |
| --------------- | --- | -------- | --- | -------- | ------ |
| `docs/prd/`     | O   | O        | R   | R        | R      |
| `docs/current/` | O   | O        | R   | R        | O      |
| `docs/task/`    | O   | O        | O   | O        | O      |
| 소스 코드           | R   | R        | O   | O        | O      |

### 쓰기 권한

| 경로              | 감독관 | Task 매니저 | 작업자   | Reviewer | Writer |
| --------------- | --- | -------- | ----- | -------- | ------ |
| `docs/prd/`     | O   | ×        | ×     | ×        | ×      |
| `docs/current/` | ×   | ×        | ×     | ×        | O      |
| `docs/task/`    | ×   | O        | O(내용) | O(상태)    | O(결과)  |
| 소스 코드           | ×   | ×        | O     | ×        | ×      |
