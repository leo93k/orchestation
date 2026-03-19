---
id: TASK-004
title: 매물 목록 페이지 UI 구현
status: backlog
priority: high
depends_on:
  - TASK-002
  - TASK-003
blocks: []
parallel_with:
  - TASK-005
owner: ""
branch: task/TASK-004-ui-list
worktree: ../repo-wt-TASK-004
reviewer: ""
affected_files:
  - src/app/page.tsx
  - src/components/ListingCard.tsx
  - src/components/FilterBar.tsx
---

## 무엇을

매물 목록 페이지(`/`)를 구현한다. 필터 바 + 매물 카드 리스트 구성.

### 생성할 파일
- `src/app/page.tsx` — 목록 페이지 (메인)
- `src/components/ListingCard.tsx` — 매물 카드 컴포넌트
- `src/components/FilterBar.tsx` — 필터 바 컴포넌트

## 어떻게

### 페이지 구조
```
┌─────────────────────────────────┐
│         FilterBar               │
│ [거래유형▼] [지역▼] [가격▼] [면적▼] │
├─────────────────────────────────┤
│  ListingCard  │  ListingCard    │
│  ListingCard  │  ListingCard    │
│  ListingCard  │  ListingCard    │
└─────────────────────────────────┘
```

### `FilterBar.tsx`
- 거래유형: select (`전체`, `매매`, `전세`, `월세`)
- 지역: select (시 → 구 → 동 순차 선택, 값은 하드코딩된 목록)
- 가격: 최소/최대 input (숫자, 만원 단위)
- 면적: 최소/최대 input (숫자, ㎡ 단위)
- 필터 변경 시 query parameter를 변경하여 `GET /api/listings`로 재요청
- 상태관리: `useState` + `useEffect`로 fetch

### `ListingCard.tsx`
- 표시 정보: 대표 이미지 1장 (images[0]), 거래유형 뱃지, 가격, 면적(전용), 지역(구/동), 방수/욕실수
- 클릭 시 `/listings/[id]` 상세 페이지로 이동 (`next/link`)
- 이미지 없을 경우 기본 placeholder 표시

### `page.tsx`
- Client Component (`"use client"`)
- FilterBar와 ListingCard 리스트 조합
- `fetch('/api/listings?' + params)`로 데이터 가져옴
- 매물 0건일 때 "등록된 매물이 없습니다" 메시지 표시

### 스타일링
- Tailwind CSS 사용 (Next.js 기본 포함)
- 반응형: 모바일 1열, 태블릿 2열, 데스크탑 3열 그리드

## 입출력

- **입력**: `GET /api/listings` 응답 데이터
- **출력**: 필터 가능한 매물 카드 리스트 화면

## 완료 조건

- [ ] `/` 접속 시 매물 목록 표시
- [ ] 필터 변경 시 목록 갱신
- [ ] 매물 카드 클릭 시 상세 페이지로 이동
- [ ] 매물 0건일 때 안내 메시지 표시
- [ ] 모바일/태블릿/데스크탑 반응형 동작
