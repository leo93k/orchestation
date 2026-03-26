---
id: TASK-244
title: notices-API-DELETE-PUT-에러핸들링-추가
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/api/notices/[id]/route.ts
  - docs/todo/notices-api-error-handling.md
---
notices/[id]/route.ts의 DELETE·PUT 핸들러에서 fs 동기 호출(unlinkSync, readFileSync, writeFileSync)에 try-catch가 없어 TOCTOU 경합 시 서버 크래시 가능.

코드 분석 후 docs/todo/notices-api-error-handling.md 에 분석 보고서를 작성하고, 해당 파일의 에러 핸들링을 추가한다.

## Completion Criteria
- DELETE 핸들러의 fs.unlinkSync를 try-catch로 감싸고 실패 시 500 JSON 응답 반환
- PUT 핸들러의 readFileSync/writeFileSync를 try-catch로 감싸고 실패 시 500 JSON 응답 반환
- docs/todo/notices-api-error-handling.md 분석 보고서 작성 완료
- 기존 로직 변경 없음 (에러 핸들링 래핑만)
