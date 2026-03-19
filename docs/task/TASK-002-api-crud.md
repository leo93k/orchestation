---
id: TASK-002
title: 매물 CRUD API 구현
status: backlog
priority: critical
depends_on:
  - TASK-001
blocks:
  - TASK-004
  - TASK-005
  - TASK-006
parallel_with:
  - TASK-003
owner: ""
branch: task/TASK-002-api-crud
worktree: ../repo-wt-TASK-002
reviewer: ""
affected_files:
  - src/app/api/listings/route.ts
  - src/app/api/listings/[id]/route.ts
  - src/lib/prisma.ts
---

## 무엇을

매물의 생성/조회(전체)/조회(단건)/수정/삭제 API를 Next.js App Router의 Route Handler로 구현한다.

### 생성할 파일
- `src/lib/prisma.ts` — Prisma Client 싱글턴
- `src/app/api/listings/route.ts` — GET(목록), POST(생성)
- `src/app/api/listings/[id]/route.ts` — GET(단건), PUT(수정), DELETE(삭제)

## 어떻게

### `src/lib/prisma.ts`
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### API 엔드포인트

| 메서드 | 경로 | 설명 | 요청 body | 응답 |
|--------|------|------|-----------|------|
| GET | `/api/listings` | 전체 목록 | 없음 | `{ listings: Listing[] }` |
| POST | `/api/listings` | 매물 생성 | Listing 필드 전체 (id, createdAt, updatedAt 제외) | `{ listing: Listing }` |
| GET | `/api/listings/[id]` | 단건 조회 | 없음 | `{ listing: Listing }` |
| PUT | `/api/listings/[id]` | 수정 | 수정할 필드만 (Partial) | `{ listing: Listing }` |
| DELETE | `/api/listings/[id]` | 삭제 | 없음 | `{ success: true }` |

### 에러 응답 형식
```json
{ "error": "에러 메시지" }
```
- 404: 존재하지 않는 매물
- 400: 필수 필드 누락
- 500: 서버 에러

### 인증: 없음 (MVP)

## 입출력

- **입력**: HTTP 요청 (위 표 참고)
- **출력**: JSON 응답 (위 표 참고)

## 완료 조건

- [ ] 5개 엔드포인트 모두 동작
- [ ] POST로 매물 생성 → GET으로 조회 확인
- [ ] PUT으로 수정 → 변경 반영 확인
- [ ] DELETE로 삭제 → 404 반환 확인
- [ ] 존재하지 않는 id 요청 시 404 응답
- [ ] 필수 필드 누락 시 400 응답
