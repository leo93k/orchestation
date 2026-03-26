---
id: TASK-231
title: query-client.ts 미사용 getQueryClient 함수 제거
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/query-client.ts
---
`src/frontend/src/lib/query-client.ts`에서 export된 `getQueryClient()` 함수와 관련 싱글톤 변수 `browserQueryClient`가 코드베이스 어디에서도 import/사용되지 않음. `makeQueryClient()`만 실제 사용 중.

미사용 코드(`getQueryClient` 함수 + `browserQueryClient` 변수)를 제거하여 데드코드 정리.

## Completion Criteria
- `getQueryClient()` 함수 및 `browserQueryClient` 변수가 `query-client.ts`에서 제거됨
- `makeQueryClient()` export는 유지됨
- 빌드(`npm run build`) 정상 통과
