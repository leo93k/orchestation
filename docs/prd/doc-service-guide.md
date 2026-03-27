# Orchestration Dashboard — 서비스 전체 기능 가이드

> 최종 수정: 2026-03-26

## 개요

AI 기반 태스크 오케스트레이션 대시보드. 코드 개선 태스크를 자동으로 생성, 실행, 리뷰, 머지하는 파이프라인을 웹 UI로 관리한다.

**URL**: `http://localhost:3000`

---

## 메뉴 구조

### 상단 헤더

| 요소 | 설명 |
|------|------|
| Run / Starting... / Running... N / Stop | orchestrate.sh 실행/중지 제어 |
| 검색 바 | `task:001`, `doc:제목` 형태로 태스크/문서 검색 |

### 사이드바

```
Home
├── Docs (7)                    ← 문서 트리
├── Tasks (154)                 ← 태스크 목록 (상태별)
│   ├── TASK-XXX (in_progress)  ← 뱅글뱅글 아이콘
│   ├── TASK-XXX (pending)      ← 주황 점
│   ├── TASK-XXX (stopped)      ← 회색 점
│   └── + New Task              ← 태스크 생성
├── Notices (53)                ← 알림 (미읽음 뱃지)
│
├── $ Cost                      ← 비용 추적
├── ↗ Monitor                   ← 시스템 모니터
├── > Terminal                  ← 웹 터미널
├── ☽ Night Worker              ← 야간 자동 작업
├── ⚙ Settings                  ← 설정
└── Requests                    ← 태스크 목록 (/api/requests → TASK-*.md 읽기)
```

---

## 페이지별 상세 설명

### 1. Tasks (`/`)

**메인 화면. 모든 태스크를 한눈에 보고 관리.**

#### 탭

| 탭 | 설명 |
|----|------|
| Current | DAG 그래프로 태스크 의존 관계 시각화 |
| All | 전체 태스크 목록 |
| In Progress | 실행 중인 태스크 |
| Pending | 대기 중인 태스크 |
| Stopped | 중지된 태스크 |
| Done | 완료된 태스크 |
| Reviewing | 리뷰 중인 태스크 |
| Rejected | 리젝된 태스크 |

#### 기능

- **필터**: priority(high/medium/low), 날짜 범위
- **정렬**: 최신순, 오래된순, 우선순위, ID
- **페이지네이션**: 10, 20, 50개 단위
- **의존 체인 그룹**: 같은 의존 체인의 태스크를 아코디언으로 묶음
- **점유 중인 SCOPE**: 실행 중인 태스크의 scope 파일 표시
- **순서 변경**: pending 태스크 드래그로 실행 순서 변경

---

### 2. Task Detail (`/tasks/[id]`)

**개별 태스크의 상세 정보, 실행, 로그, 리뷰 결과.**

#### 상단 정보

- 태스크 제목, 상태, 우선순위, 생성일, 브랜치명
- `▶ 실행` 버튼 (개별 태스크 단독 실행)
- `■ Stop` 버튼 (실행 중인 태스크 중지)

#### Dependency Flow

- 의존하는 태스크 → 현재 태스크 → 의존받는 태스크
- 클릭하면 해당 태스크 상세로 이동
- 가로 스크롤 지원

#### 탭

| 탭 | 내용 |
|----|------|
| Content | 태스크 마크다운 전체 내용 |
| Scope | 작업 범위 파일 목록 |
| Cost | 이 태스크의 task/review 단계별 비용 |
| AI Result | Claude가 생성한 결과물 |
| 로그 | 실행 로그 (실시간 폴링) |
| 리뷰 결과 | 리뷰어의 승인/수정요청 피드백 |

---

### 3. New Task (`/tasks/new`)

**AI 기반 태스크 생성.**

#### 두 가지 모드

| 모드 | 설명 |
|------|------|
| Direct Write | 직접 제목/내용 입력 → AI가 분석하여 완료 조건, scope 자동 추천 |
| Suggest | 코드베이스를 스캔하여 개선할 태스크 자동 제안 |

#### 입력 필드

- 제목, 설명, 우선순위
- 완료 조건 (체크리스트)
- Scope (작업 범위 파일)
- 의존성 (depends_on)
- Role (worker/reviewer 역할 지정)

#### API 흐름

```
[Direct Write] 분석 → POST /api/tasks/analyze → 미리보기 → POST /api/requests (태스크 생성)
[Suggest]      POST /api/tasks/suggest → 선택 → POST /api/requests (태스크 생성)
```

> **구현 노트**: 태스크 생성 시 내부적으로 `POST /api/requests`를 호출하며,
> 이 엔드포인트는 `.orchestration/tasks/TASK-*.md` 파일을 생성한다.
> API 경로명의 "requests"는 레거시 명칭이며, 실제로는 Task를 생성한다.
> 태스크 상세 페이지(`/tasks/[id]`)도 `GET /api/requests/[id]`를 통해 데이터를 조회한다.

---

### 4. Cost (`/cost`)

**Claude API 호출 비용 추적.**

#### 구성

| 영역 | 설명 |
|------|------|
| Summary Cards | 총 비용, 태스크 수, 평균 비용, 모델별 비용 |
| Cumulative Chart | 시간 순 누적 비용 그래프 |
| Cost Table | 개별 호출 목록 (전 컬럼 정렬 가능) |

#### 테이블 컬럼

Task ID (클릭 → 상세), Phase (task/review), Model, Cost, Time, Turns, Tokens, 시각

---

### 5. Monitor (`/monitor`)

**시스템 리소스 + 워커 프로세스 실시간 모니터링.**

#### System Monitor

| 지표 | 설명 |
|------|------|
| CPU Utilization | 사용자/시스템/대기 비율 |
| Memory Usage | 사용/전체 메모리 |
| Load Average | 1분/5분/15분 |
| Threads/Processes | 시스템 전체 수 |

#### Orchestrate Workers

- 실행 중인 태스크 워커만 표시 (사용자 claude 세션 제외)
- 워커별 CPU/메모리 사용량 그래프
- PID, Task ID 표시

#### 폴링

- 10초 간격 (기존 1초에서 개선)
- 페이지 visible일 때만 폴링
- execSync 호출 최적화 (프로세스 트리 1회 조회)

---

### 6. Terminal (`/terminal`)

**웹 기반 터미널. 서버에서 직접 명령어 실행.**

- node-pty + WebSocket 기반
- xterm-256color 지원
- 리사이즈 대응
- 5분 idle timeout (자동 종료)

---

### 7. Night Worker (`/night-worker`)

**야간 자동 코드 스캔 + 태스크 생성.**

#### 설정

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 종료 시각 | 이 시각까지 실행 | 07:00 |
| 예산 | 최대 API 비용 | 무제한 |
| 최대 태스크 수 | 생성할 태스크 상한 | 10 |
| 스캔 유형 | 아래 6가지 중 선택 | typecheck,lint,review |

#### 스캔 유형

| 유형 | 설명 |
|------|------|
| typecheck | TypeScript strict 모드 타입 에러 |
| lint | ESLint 위반 |
| unused | 미사용 import, 변수, 함수, 파일 |
| docs | 코드 분석 보고서 생성 |
| test | 테스트 커버리지 부족 영역 |
| review | 코드 품질 이슈 (복잡도, 중복, 안티패턴) |

#### 탭

- **Config**: 설정 변경 + 실행 버튼
- **Logs**: 실행 로그 실시간 표시

---

### 8. Settings (`/settings`)

**시스템 설정.**

| 항목 | 설명 | 기본값 |
|------|------|--------|
| API Key | Anthropic API 키 | - |
| Model | 기본 모델 | claude-sonnet-4-6 |
| Source Paths | 스캔 대상 경로 | src/ |
| Max Parallel | 동시 실행 태스크 수 | 3 |
| Max Review Retry | 리뷰 재시도 상한 | 2 |
| Base Branch | 머지 대상 브랜치 | main |

**핫 리로드**: Max Parallel은 orchestrate.sh가 매 루프마다 다시 읽음. 서버 재시작 불필요.

---

### 9. Docs (`/docs`, `/docs/[id]`)

**프로젝트 문서 트리 브라우저.**

- 폴더 구조로 문서 탐색
- 마크다운 렌더링
- PRD, 아키텍처 문서, 가이드 등

---

### 10. Notices (`/notices`)

**시스템 알림 센터.**

| 유형 | 설명 |
|------|------|
| Info | 태스크 완료, 머지 성공 등 |
| Warning | 머지 충돌 자동 해결 등 |
| Error | 태스크 실패, 리뷰 상한 초과 등 |

- 검색, 유형별 필터
- 읽음/미읽음 관리
- 사이드바에 미읽음 뱃지 표시

---

### 11. Sprint (`/sprint`, `/sprint/[id]`)

**스프린트 관리.**

#### 목록 (`/sprint`)

- 전체 스프린트 목록
- 인라인 상세: List / Board 뷰

#### 상세 (`/sprint/[id]`)

| 뷰 | 설명 |
|----|------|
| List | 배치별 태스크 그룹 |
| Board | 상태별 칸반 보드 |
| Timeline | 간트 차트 + 의존성 시각화 |

---

### 12. Plan (`/plan`)

**태스크 목록 (TASK-*.md 기반). `/api/requests` 엔드포인트를 통해 조회.**

> **현재 구현 상태**: `/api/requests` 경로명은 레거시 명칭이나, 실제로는 `.orchestration/tasks/TASK-*.md` 파일을 읽고 쓴다.
> REQ-*.md 파일 기반의 구 Request 개념은 완전히 폐기되었고, `docs/requests/` 폴더는 미사용 상태다.
> 태스크 생성(`/tasks/new`)과 태스크 상세(`/tasks/[id]`)도 모두 `/api/requests` 엔드포인트를 사용 중이다.
> `/api/tasks`로의 경로 통일은 [TBD] 마이그레이션 예정이다.

---

## Run / Stop 동작

### Run

```
Run 클릭 → "Starting..." → orchestrate.sh spawn
→ 태스크 스캔 → 의존성/scope/메모리 체크
→ MAX_PARALLEL개 동시 투입
→ "Running... N" + Stop 버튼 표시
```

### Stop

```
Stop 클릭 → "Stopping..." → 즉시 전체 종료
→ orchestrate.sh kill
→ 모든 워커 kill
→ in_progress → stopped
→ lock/PID 정리
→ Run 버튼으로 복귀
```

### 비정상 종료 감지

```
orchestrate.sh가 외부에서 kill됨
→ reconcileStateWithOS()가 kill(pid,0) 실패 감지
→ 즉시 UI 갱신 (서버 재시작 불필요)
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS |
| State | zustand + React Query |
| 차트 | recharts |
| 터미널 | xterm.js + node-pty |
| Backend | Node.js (tsx server.ts) |
| Orchestration | bash (orchestrate.sh, job-task.sh, job-review.sh) |
| AI | Claude CLI (`claude --dangerously-skip-permissions`) |
| Git | worktree 기반 병렬 작업 |
