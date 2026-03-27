# iTerm 모드 폴링 비효율 및 중지 상태 불일치 (2026-03-27)

## 요약
개별 실행에 iTerm 모드를 추가하면서, iTerm 탭에서 실행되는 프로세스의 완료를 감지하기 위해 `setInterval` 폴링(2초)을 사용했다. 이로 인해 두 가지 문제가 발생:

1. **중지 후 UI "실행 중" 고스트**: stop 시 폴링 타이머가 정리되지 않아 상태가 꼬임
2. **폴링 자체의 비효율**: 2초마다 signal 파일 + 로그 파일을 읽는 것은 불필요한 I/O

## 증상
- TASK-253 중지 후 task 파일은 "Stopped"이나, UI 배너는 "태스크 실행 중..." 유지
- 로그에 "Stop requested for TASK-253"이 4회 반복 출력 (폴링이 계속 돌고 있었음)

## 근본 원인

### 1. 폴링 타이머 미정리

`TaskRunnerManager.stop()`이 호출되면:
- dummy 프로세스 kill ✅
- iTerm 프로세스 kill ✅
- state.status = "failed" ✅
- `done` 이벤트 emit ✅
- **폴링 타이머 clearInterval** ❌ ← 빠져있음

폴링 타이머가 계속 돌면서 signal 파일을 체크하고, 이미 정리된 상태를 다시 덮어쓸 수 있다.

### 2. 폴링이라는 접근 자체의 문제

iTerm 모드에서 프로세스 완료를 감지하기 위해 `setInterval(2000)`으로:
- signal 디렉토리의 `task-done` / `task-failed` 파일 존재 체크
- 로그 파일 크기 변경 감지 → 새 내용 읽기

이 방식의 문제점:
- **지연**: 최대 2초 딜레이로 완료 감지
- **불필요한 I/O**: 매 2초마다 `fs.existsSync` + `fs.statSync` + `fs.readSync`
- **타이머 관리 복잡**: 폴링 시작/정리/중복 방지 로직이 필요

## 개선안

### 1. fs.watch 이벤트 기반 감지 (권장)

signal 디렉토리에 `fs.watch`를 걸어 파일 생성 이벤트를 즉시 감지한다. 이미 SSE 엔드포인트(`/api/tasks/watch`)에서 `TASKS_DIR`에 동일 패턴을 사용 중이므로 검증된 방식.

```typescript
private watchSignals(taskId: string, signalDir: string, callback: (type: string) => void): fs.FSWatcher {
  return fs.watch(signalDir, (event, filename) => {
    if (!filename?.startsWith(taskId)) return;
    if (filename.endsWith("-task-done")) callback("task-done");
    else if (filename.endsWith("-task-failed")) callback("task-failed");
    else if (filename.endsWith("-review-approved")) callback("review-approved");
    else if (filename.endsWith("-review-rejected")) callback("review-rejected");
  });
}
```

장점:
- 파일 생성 즉시 감지 (~50ms)
- 불필요한 주기적 I/O 없음
- `watcher.close()`로 깔끔하게 정리 가능 (stop 시)

로그 파일 tail도 동일하게 `fs.watch`로 변경 가능:
```typescript
fs.watch(logFile, () => {
  // 파일 변경 시에만 새 내용 읽기
});
```

### 2. HTTP callback (대안)

job-task.sh / job-review.sh 완료 시 서버 API를 직접 호출:

```bash
# job-task.sh 끝에 추가
curl -s -X POST "http://localhost:3000/api/tasks/${TASK_ID}/signal?type=task-done" || true
```

장점:
- 즉시 알림, 파일 감시 불필요
- 서버에서 바로 상태 전이 처리 가능

단점:
- shell 스크립트에 서버 의존성 추가
- 서버가 죽어있으면 signal 유실 (fallback 필요)

### 3. 폴링 유지 + 타이머 정리 수정 (최소 변경)

현재 폴링 방식을 유지하되, 타이머 관리만 수정:
- `pollTimers` Map에 타이머 등록
- `stop()` 시 `clearInterval` + Map에서 제거
- 폴링 콜백 시작 시 `state.status !== "running"` 체크

이 방식은 근본적 비효율을 해결하지 않지만, 즉시 적용 가능하고 중지 버그는 해결됨.

## 우선순위

| 순서 | 개선안 | 효과 | 난이도 |
|------|--------|------|--------|
| 1 | fs.watch 이벤트 기반 | 즉시 감지 + I/O 효율 + 정리 용이 | 중간 |
| 2 | HTTP callback | 즉시 감지 + 가장 단순 | 낮음 (but 서버 의존) |
| 3 | 폴링 + 타이머 정리 | 중지 버그만 해결 | 낮음 |

**권장: 1번 (fs.watch)**. 이미 프로젝트에서 사용 중인 패턴이고, signal 파일 시스템과 자연스럽게 통합됨.
