# notices/[id] API 파일 I/O 에러 핸들링 보고서

- **작성일**: 2026-03-27
- **대상 파일**: `src/frontend/src/app/api/notices/[id]/route.ts`
- **심각도**: Medium (운영 중 예외 발생 시 500 에러 비제어 전파)

---

## 1. 영향받는 핸들러 및 라인 번호

| 핸들러 | 함수 | 라인 | 문제 |
|--------|------|------|------|
| `PUT` | `fs.readFileSync` | 30 | try-catch 없음 — 파일 읽기 실패 시 unhandled exception |
| `PUT` | `fs.writeFileSync` | 51 | try-catch 없음 — 파일 쓰기 실패 시 unhandled exception |
| `DELETE` | `fs.unlinkSync` | 64 | try-catch 없음 — 파일 삭제 실패 시 unhandled exception |

세 호출 모두 Node.js 동기 I/O이며, 실패 시 예외를 throw하는 API다.
현재 코드에는 어떠한 try-catch도 없어 Next.js 런타임이 예외를 그대로 받아 `500 Internal Server Error`를 반환한다. 이때 스택 트레이스가 클라이언트에 노출될 수 있다.

---

## 2. 발생 가능한 장애 시나리오

### 2-1. TOCTOU (Time-Of-Check-Time-Of-Use) 경쟁 조건
`findNoticeFile(id)`로 파일 존재를 확인한 뒤 실제 I/O 호출 사이에 파일이 삭제되거나 이동할 수 있다.

```
PUT /api/notices/123
  1. findNoticeFile("123") → /data/notices/123.md  ✅ 존재 확인
  2. [다른 프로세스가 123.md 삭제]
  3. fs.readFileSync(filePath) → ENOENT → 500 💥
```

### 2-2. 디스크 공간 부족 / 쓰기 오류
`fs.writeFileSync` 실행 도중 디스크가 가득 차면 `ENOSPC` 예외가 throw된다.
이 경우 파일이 **부분 기록(partial write)** 상태로 손상될 수 있고, 에러가 제어되지 않아 클라이언트에는 500만 반환된다.

### 2-3. 파일 권한 오류
배포 환경에서 프로세스 실행 계정에 파일 읽기/쓰기/삭제 권한이 없을 때 `EACCES` 예외가 발생한다.

### 2-4. 심볼릭 링크 / 경로 조작
`id` 파라미터 검증이 `findNoticeFile` 내부 구현에 의존하고 있다. 만약 `id`에 경로 조각(`../`, `%2F` 등)이 포함될 경우 의도치 않은 경로의 파일이 삭제될 수 있다.
현재 `[id]/route.ts`에서 `id`에 대한 별도 입력 검증 로직이 없다.

### 2-5. 동시 요청에 의한 쓰기 충돌
두 `PUT` 요청이 동시에 같은 파일을 읽고 각자 수정 후 쓰면, 먼저 완료된 변경이 덮어써진다(lost update).

---

## 3. 권장 수정 방안

### 3-1. 입력 검증 추가 (id 파라미터)

```typescript
function isValidNoticeId(id: string): boolean {
  return /^[\w\-]+$/.test(id); // 영문자, 숫자, 하이픈만 허용
}
```

각 핸들러 진입부에서 `isValidNoticeId(id)`를 확인하고, 실패 시 400 반환.

### 3-2. PUT 핸들러 — try-catch 적용

```typescript
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isValidNoticeId(id)) {
    return NextResponse.json({ error: "Invalid notice id" }, { status: 400 });
  }

  const filePath = findNoticeFile(id);
  if (!filePath) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error("[PUT] readFileSync failed:", err);
    return NextResponse.json({ error: "Failed to read notice file" }, { status: 500 });
  }

  // ... 기존 수정 로직 ...

  try {
    fs.writeFileSync(filePath, updated, "utf-8");
  } catch (err) {
    console.error("[PUT] writeFileSync failed:", err);
    return NextResponse.json({ error: "Failed to write notice file" }, { status: 500 });
  }

  const notice = parseNoticeFile(filePath);
  return NextResponse.json(notice);
}
```

### 3-3. DELETE 핸들러 — try-catch 적용

```typescript
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isValidNoticeId(id)) {
    return NextResponse.json({ error: "Invalid notice id" }, { status: 400 });
  }

  const filePath = findNoticeFile(id);
  if (!filePath) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("[DELETE] unlinkSync failed:", err);
    return NextResponse.json({ error: "Failed to delete notice file" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

### 3-4. (선택) 비동기 I/O로 전환
`fs.promises.readFile` / `writeFile` / `unlink`를 사용하면 I/O 중 Node.js 이벤트 루프를 블로킹하지 않아 동시 요청 처리 성능이 향상된다.

### 3-5. (선택) 쓰기 원자성 보장
`writeFileSync` 직접 쓰기 대신 임시 파일에 먼저 기록 후 `fs.renameSync`로 교체하면 부분 기록으로 인한 파일 손상을 방지할 수 있다.

---

## 4. 우선순위 권고

| 항목 | 우선순위 | 이유 |
|------|----------|------|
| try-catch 추가 (PUT readFileSync) | **High** | TOCTOU로 즉시 재현 가능 |
| try-catch 추가 (PUT writeFileSync) | **High** | 디스크 오류 시 데이터 손상 위험 |
| try-catch 추가 (DELETE unlinkSync) | **High** | 권한 오류 시 500 비제어 |
| id 입력 검증 | **High** | 경로 조작 방어 |
| 비동기 I/O 전환 | Medium | 성능 개선, 즉각 장애 아님 |
| 원자적 쓰기 | Medium | 데이터 안정성 강화 |
| 동시 쓰기 뮤텍스 | Low | 현재 트래픽 수준 무방할 가능성 높음 |
