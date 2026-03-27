# 야간 배치 전체 실패 (2026-03-27)

## 요약
Night Worker가 생성한 23개 태스크가 전부 실패. Night Worker 자체는 정상 동작했으며, orchestrate 실행 파이프라인(`job-task.sh`)의 버그 3건이 원인.

## 영향
- **실패 태스크:** 24개 (TASK-205, TASK-225, TASK-228~250)
- **소요 비용:** $9.33 (태스크 생성 비용만 발생, 실행은 대부분 즉시 실패)
- **실행 시간:** 2026-03-26 10:06 ~ 15:08 (약 5시간)

## 근본 원인

### Bug 1: 중복 frontmatter로 인한 worktree 생성 실패
- **파일:** `scripts/job-task.sh:80-81`, `scripts/job-review.sh:56-57`
- **증상:** `git worktree add` 시 `fatal: 잘못된 레퍼런스` 에러
- **원인:** Night Worker가 태스크 파일을 생성할 때 frontmatter 블록이 2개 들어감. `grep '^branch:'`가 2줄을 반환하여 BRANCH 변수가 멀티라인이 됨 → git 명령 실패
- **영향:** 23개 중 약 20개 태스크
- **수정:** `grep` 뒤에 `head -1` 추가하여 첫 번째 값만 사용

### Bug 2: stream-json 출력 미저장 (JSONL 파일 누락)
- **파일:** `scripts/job-task.sh:187-188`
- **증상:** `grep: ...conversation.jsonl: No such file or directory`
- **원인:** Claude 호출 시 `--output-format stream-json` 출력을 파이프로 실시간 파싱하면서 파일 저장을 누락. 이후 result 추출 시 존재하지 않는 파일을 읽으려 해서 실패
- **영향:** worktree 생성에 성공한 태스크도 이 단계에서 실패 (TASK-246, TASK-250 등)
- **수정:** `tee "$CONV_FILE"` 추가하여 스트림을 파일에도 저장

### Bug 3: PIPESTATUS 산술 비교 에러
- **파일:** `scripts/job-task.sh:202-203`
- **증상:** `[ "$CLAUDE_EXIT" -ne "" ]` 산술 비교 실패
- **원인:** 빈 문자열과 `-ne` 비교 시 bash 에러 발생
- **수정:** 기본값 `:-0` 추가 및 불필요한 빈 문자열 비교 제거

## 실패 로그 패턴

### 패턴 A: Worktree 실패 (대다수)
```
🔨 Worktree 생성 중...
fatal: 잘못된 레퍼런스: task/task-XXX
```

### 패턴 B: JSONL 파일 누락 (worktree 성공 후)
```
━━━ Claude 작업 완료 ━━━
grep: ...TASK-XXX-task-conversation.jsonl: No such file or directory
```

## 수정 커밋
- `scripts/job-task.sh` — Bug 1, 2, 3 수정
- `scripts/job-review.sh` — Bug 1 수정 (중복 frontmatter 방어)

## 재발 방지
- Night Worker의 태스크 파일 생성 로직에서 중복 frontmatter가 발생하지 않도록 검증 필요
- `stream-json` 모드 전환 시 파일 저장 경로가 유지되는지 테스트 추가 권장
