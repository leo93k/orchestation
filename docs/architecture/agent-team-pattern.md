# Agent Team 패턴 — 병렬 조사 아키텍처

## 개요

Claude Code의 Agent 도구를 활용하여 복수의 서브에이전트를 **병렬로 실행**하고, 메인 에이전트가 결과를 종합하는 패턴.

복잡한 코드 분석, 버그 조사, 아키텍처 리뷰 등에서 사용한다.

## 실행 원리

프로세스를 fork/spawn하는 것이 아니다. 메인 Claude가 **하나의 응답에 여러 Agent tool call을 포함**하면, Claude Code 런타임(하네스)이 이를 **동시에 dispatch**한다. 각 서브에이전트는 별도의 Claude API 세션으로 실행되지만, 프로세스 관리는 런타임이 담당한다.

```
메인 Claude → 하나의 응답에 3개 Agent tool call 반환
                │
Claude Code 런타임이 3개를 동시 dispatch
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    Agent A  Agent B  Agent C   (각각 독립된 Claude API 세션)
    (Explore) (Explore) (Explore)
    읽기만    읽기만    읽기만
        │       │       │
        └───────┼───────┘
                ▼
    3개 결과가 메인 컨텍스트로 반환
                │
                ▼
    메인이 종합 → 직접 Edit/Write로 코드 수정
```

**중요**: 서브에이전트(Explore/Plan)는 조사만 한다. 코드 수정은 메인이 직접 수행한다.

## 에이전트 타입

| 타입 | 용도 | 사용 가능 도구 | 코드 수정 |
|------|------|---------------|----------|
| `Explore` | 코드 탐색, 키워드 검색, 구조 파악 | Read, Grep, Glob, Bash(읽기) | **불가** — Edit/Write 없음 |
| `Plan` | 구현 계획 수립, 아키텍처 설계 | Read, Grep, Glob, Bash(읽기) | **불가** — Edit/Write 없음 |
| `general-purpose` | 범용 — 조사 + 코드 수정 가능 | 전체 (Edit, Write 포함) | **가능** |

타입은 **능력의 제약**이지, 실행 순서를 강제하지 않는다. 3가지 타입 모두 동시에 병렬 실행 가능.

## 실행 모드

### Foreground (기본)
```
모든 에이전트 결과가 돌아올 때까지 대기한 뒤 다음 단계 진행.
결과가 다음 작업에 필요할 때 사용.
```

### Background (`run_in_background: true`)
```
에이전트를 띄운 뒤 다른 작업을 병행. 완료 시 알림.
결과가 당장 필요하지 않을 때 사용.
```

### Worktree 격리 (`isolation: "worktree"`)
```
임시 git worktree에서 실행. 에이전트가 코드를 수정해도 메인 브랜치에 영향 없음.
코드 수정이 필요한 에이전트를 안전하게 돌릴 때 사용.
```

## 실제 사용 사례: 좀비 in_progress 버그 분석 (2026-03-30)

### 문제
`orchestrate.sh`가 태스크를 `in_progress`로 전환 후 워커가 죽으면 영구 교착 상태 발생.

### 투입한 에이전트 팀

| 에이전트 | 타입 | 조사 범위 | 핵심 발견 |
|---------|------|----------|----------|
| `orchestrate-analyzer` | Explore | `orchestrate.sh` — start_task, process_signals, 메인 루프, cleanup | 5개 문제 모두 미수정 확인 |
| `job-task-analyzer` | Explore | `job-task.sh` — 시그널 생성, claude spawn, EXIT trap | job-task.sh 자체는 안전 (EXIT trap 있음). 문제는 시작 실패 시 |
| `recovery-analyzer` | Explore | 프로젝트 전체 — 기존 복구 메커니즘, PID 관리, known-issues | cleanup-stuck.sh(수동), cleanupZombies(서버 시작 시만) 존재. 런타임 감지 부재 |

### 결과 종합 → 메인이 직접 구현

3개 Explore 에이전트는 **조사만** 수행. 코드 수정(Edit/Write)은 전부 **메인 Claude가 직접** 실행:

1. **`process_signals_for_task()`에 PID liveness 체크** — 시그널 없을 때 `kill -0`으로 워커 생사 확인
2. **`start_task()`에 dispatch 후 검증** — nohup 후 2초 대기, 프로세스 죽었으면 pending 원복
3. **`_write_crashlog()` 헬퍼** — 사망 시 진단 정보(태스크 정보, PID, 시그널, 프로세스 스냅샷, 로그 tail) 기록
4. **메인 루프 health sweep** — 10회 루프마다 RUNNING 태스크의 PID 생존 확인

## 설계 원칙

### 병렬로 돌리는 이유
- **속도**: 순차 실행 대비 ~3배 빠름
- **컨텍스트 보호**: 각 에이전트가 수백 줄을 읽어도 메인 컨텍스트에는 요약만 들어옴
- **관심사 분리**: 각자 다른 관점으로 조사하여 놓치는 부분 최소화

### 에이전트 분리 기준
- **코드 영역별**: 파일/모듈 단위로 분리 (예: orchestrate.sh vs job-task.sh)
- **관점별**: 같은 코드라도 "현재 구현" vs "기존 복구 메커니즘" 등으로 분리
- **의존성 없이**: 에이전트 간 결과 의존이 없어야 병렬 실행 가능

### 언제 사용하는가
- 코드베이스의 여러 영역을 동시에 조사해야 할 때
- 단순 Grep/Glob으로 3회 이상 탐색이 필요한 깊은 조사
- 버그 분석, 아키텍처 리뷰, 리팩토링 사전 조사

### 의존성에 따른 실행 흐름

에이전트 간 결과 의존이 없으면 동시, 있으면 순차:

```
# 케이스 1: 독립 조사 → 동시 실행 + 메인 수정
Explore A ──┐
Explore B ──┼── 동시 → 메인 종합 → 메인이 직접 코드 수정
Explore C ──┘

# 케이스 2: 조사 → 수정까지 에이전트에게 위임
Explore A + B (동시)
      │ 결과
      ▼
general-purpose C (결과 기반 수정) ── 순차, worktree 격리 권장

# 케이스 3: 독립적인 수정 작업 → 각자 worktree에서 동시
general-purpose A (worktree) ──┐
general-purpose B (worktree) ──┼── 동시, 각자 격리된 브랜치
general-purpose C (worktree) ──┘
```

### 언제 사용하지 않는가
- 특정 파일 1~2개만 읽으면 되는 단순 작업 → 직접 Read/Grep
- 에이전트 간 결과가 서로 의존하는 경우 → 순차 실행
