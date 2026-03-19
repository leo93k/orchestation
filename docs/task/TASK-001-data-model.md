---
id: TASK-001
title: 매물 데이터 모델 및 DB 스키마 구성
status: backlog
priority: critical
depends_on: []
blocks:
  - TASK-002
  - TASK-003
  - TASK-004
parallel_with: []
owner: ""
branch: task/TASK-001-data-model
worktree: ../repo-wt-TASK-001
reviewer: ""
affected_files:
  - prisma/schema.prisma
  - src/types/listing.ts
---

## 무엇을

PostgreSQL + Prisma ORM으로 매물(Listing) 데이터 모델을 정의한다.

### 생성할 파일
- `prisma/schema.prisma` — DB 스키마
- `src/types/listing.ts` — TypeScript 타입 정의

### 스키마 필드 정의

```prisma
model Listing {
  id            String   @id @default(cuid())
  title         String
  description   String
  images        String[] // 이미지 URL 배열
  price         Int      // 매매가 또는 보증금 (만원 단위)
  monthlyRent   Int?     // 월세일 경우만 (만원 단위)
  dealType      DealType // SALE, JEONSE, MONTHLY
  areaExclusive Float    // 전용면적 (㎡)
  areaSupply    Float    // 공급면적 (㎡)
  regionSi      String   // 시/도
  regionGu      String   // 구/군
  regionDong    String   // 동/읍/면
  address       String   // 상세주소
  floor         Int
  rooms         Int
  bathrooms     Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum DealType {
  SALE
  JEONSE
  MONTHLY
}
```

## 어떻게

1. 프로젝트 루트에 Prisma 초기화: `npx prisma init`
2. `prisma/schema.prisma`에 위 스키마 작성
3. `src/types/listing.ts`에 동일 구조의 TypeScript 타입/enum 정의
4. `npx prisma migrate dev --name init`로 마이그레이션 실행

### 사용 라이브러리
- `prisma` (devDependency)
- `@prisma/client` (dependency)

## 입출력

- **입력**: 없음 (초기 스키마 정의)
- **출력**: PostgreSQL에 `Listing` 테이블, `DealType` enum 생성 완료

## 완료 조건

- [ ] `npx prisma migrate dev` 에러 없이 실행
- [ ] `npx prisma generate` 성공
- [ ] `src/types/listing.ts` 타입이 스키마와 1:1 일치
- [ ] PostgreSQL에 테이블 생성 확인
