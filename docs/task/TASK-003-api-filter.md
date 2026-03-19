---
id: TASK-003
title: 매물 필터링 API 구현
status: backlog
priority: high
depends_on:
  - TASK-001
blocks:
  - TASK-004
parallel_with:
  - TASK-002
owner: ""
branch: task/TASK-003-api-filter
worktree: ../repo-wt-TASK-003
reviewer: ""
affected_files:
  - src/app/api/listings/route.ts
---

## 주의사항

**이 Task는 TASK-002와 parallel이지만 `src/app/api/listings/route.ts`의 GET 핸들러를 수정한다.**
따라서 TASK-002에서 GET 핸들러의 기본 구조를 먼저 머지한 후, 이 Task에서 필터 로직을 추가하는 방식으로 진행한다.

> 실행 순서: TASK-002의 GET 핸들러 머지 → TASK-003에서 해당 파일에 필터 추가

## 무엇을

`GET /api/listings`에 query parameter 기반 필터링을 추가한다.

### 지원 필터

| Query Param | 타입 | 설명 | 예시 |
|-------------|------|------|------|
| `dealType` | string | 거래유형 | `?dealType=JEONSE` |
| `regionSi` | string | 시/도 | `?regionSi=서울특별시` |
| `regionGu` | string | 구/군 | `?regionGu=강남구` |
| `regionDong` | string | 동 | `?regionDong=역삼동` |
| `priceMin` | number | 최소 가격 (만원) | `?priceMin=10000` |
| `priceMax` | number | 최대 가격 (만원) | `?priceMax=50000` |
| `areaMin` | number | 최소 전용면적 (㎡) | `?areaMin=30` |
| `areaMax` | number | 최대 전용면적 (㎡) | `?areaMax=85` |

## 어떻게

`GET /api/listings` Route Handler에서:

1. `NextRequest`의 `searchParams`로 query parameter 추출
2. 값이 있는 필터만 Prisma `where` 조건에 추가
3. 가격 필터는 `price` 필드에 `gte`/`lte` 적용
4. 면적 필터는 `areaExclusive` 필드에 `gte`/`lte` 적용
5. 문자열 필터는 정확 일치 (`equals`)

```ts
// 예시 where 조건 구성
const where: Prisma.ListingWhereInput = {}
if (dealType) where.dealType = dealType as DealType
if (regionSi) where.regionSi = regionSi
if (priceMin || priceMax) {
  where.price = {
    ...(priceMin && { gte: Number(priceMin) }),
    ...(priceMax && { lte: Number(priceMax) }),
  }
}
```

## 입출력

- **입력**: `GET /api/listings?dealType=SALE&regionSi=서울특별시&priceMin=10000&priceMax=50000`
- **출력**: 필터 조건에 맞는 매물만 반환 `{ listings: Listing[] }`
- 필터 없으면 전체 반환 (기존 동작 유지)

## 완료 조건

- [ ] `dealType` 필터 동작 확인
- [ ] `regionSi`, `regionGu`, `regionDong` 필터 동작 확인
- [ ] `priceMin`, `priceMax` 범위 필터 동작 확인
- [ ] `areaMin`, `areaMax` 범위 필터 동작 확인
- [ ] 복수 필터 조합 동작 확인 (예: dealType + regionSi + priceMax)
- [ ] 필터 없이 요청 시 전체 목록 반환
