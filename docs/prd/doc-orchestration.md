# 오케스트레이션 파이프라인

## 실행 흐름

```
orchestrate.sh
│
├── 1. Task 수집: docs/task/*.md에서 status=backlog인 Task 수집
├── 2. 의존 관계 분석: depends_on 기반으로 배치(batch) 구성
├── 3. 배치별 병렬 실행:
│   ├── Task A ──→ run-worker.sh ──→ iTerm 패널
│   └── Task B ──→ run-worker.sh ──→ iTerm 패널
├── 4. 배치 완료 대기
├── 5. 다음 배치 실행
└── 6. 전체 완료 → main 머지
```

## run-worker.sh 내부

```
run-worker.sh TASK-XXX
│
├── 1. run-task.sh TASK-XXX
│   ├── worktree 생성
│   ├── 역할 프롬프트 로드 (--system-prompt)
│   ├── Claude CLI 실행 (에이전트 모드)
│   └── 결과 저장 (output/TASK-XXX-task.json)
│
├── 2. run-review.sh TASK-XXX
│   ├── 리뷰어 프롬프트 로드
│   ├── Claude CLI 실행
│   └── 승인/수정요청 판정
│
├── 3. 수정요청 시:
│   ├── 피드백 파일 생성
│   └── run-task.sh TASK-XXX FEEDBACK → 재실행
│
└── 4. 최대 재시도: 10회
```

## Claude CLI 호출 방식

```bash
# 에이전트 모드 (검증 루프 허용)
echo "$PROMPT" | claude --output-format json \
  --dangerously-skip-permissions \
  --system-prompt "$ROLE_PROMPT"

# 역할은 --system-prompt, 작업 지시는 stdin으로 전달
# -p (print 모드) 대신 에이전트 모드 사용 → 코드 작성/실행/검증 가능
```

## 비용 로그

```
[날짜] TASK-ID | phase=task/review | input=N cache_create=N cache_read=N output=N | turns=N | duration=Nms | cost=$N
```
