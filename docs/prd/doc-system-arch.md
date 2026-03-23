# 시스템 구조

## 전체 아키텍처

```
┌──────────────────────────────────────────────┐
│                  Web Dashboard                │
│  (Next.js — Task/Sprint/Docs/Cost/Terminal)   │
└─────────────────────┬────────────────────────┘
                      │ API
┌─────────────────────┴────────────────────────┐
│              Orchestration Layer              │
│                                               │
│  orchestrate.sh                               │
│    ├── run-task.sh → Claude CLI (에이전트)     │
│    ├── run-review.sh → Claude CLI (리뷰어)    │
│    └── run-worker.sh (task + review 루프)      │
└─────────────────────┬────────────────────────┘
                      │
┌─────────────────────┴────────────────────────┐
│              File System (docs/)              │
│                                               │
│  docs/task/TASK-*.md    ← Task 정의           │
│  docs/sprint/SPRINT-*.md ← Sprint 정의        │
│  docs/roles/*.md         ← 역할 프롬프트      │
│  docs/prd/*.md           ← PRD 문서           │
│  output/token-usage.log  ← 비용 로그          │
└──────────────────────────────────────────────┘
```

## 데이터 흐름

1. **Task 정의** → docs/task/TASK-XXX.md (frontmatter: status, branch, role, depends_on)
2. **orchestrate.sh** → Task를 의존 관계에 따라 배치로 분류
3. **run-task.sh** → Claude CLI로 에이전트 실행 (역할 프롬프트 + 작업 지시)
4. **run-review.sh** → Claude CLI로 리뷰어 실행 (완료 조건 검증)
5. **승인** → main에 머지 / **수정요청** → run-task.sh 재실행
6. **비용 기록** → output/token-usage.log

## 디렉토리 구조

```
orchestation/
├── scripts/              # 실행 스크립트
│   ├── orchestrate.sh    # 메인 오케스트레이터
│   ├── run-task.sh       # 작업자 에이전트
│   ├── run-review.sh     # 리뷰어 에이전트
│   ├── run-worker.sh     # task + review 루프
│   └── run-pipeline.sh   # 단일 태스크 파이프라인
├── docs/                 # 모든 문서
├── src/frontend/         # Next.js 대시보드
└── output/               # 실행 결과물
```
