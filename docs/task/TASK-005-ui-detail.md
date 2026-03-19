---
id: TASK-005
title: 매물 상세 페이지 UI 구현
status: backlog
priority: high
depends_on:
  - TASK-002
blocks: []
parallel_with:
  - TASK-004
owner: ""
branch: task/TASK-005-ui-detail
worktree: ../repo-wt-TASK-005
reviewer: ""
affected_files:
  - src/app/listings/[id]/page.tsx
  - src/components/ImageGallery.tsx
---

## 무엇을

매물 상세 페이지(`/listings/[id]`)를 구현한다.

### 생성할 파일
- `src/app/listings/[id]/page.tsx` — 상세 페이지
- `src/components/ImageGallery.tsx` — 이미지 갤러리 컴포넌트

## 어떻게

### 페이지 구조
```
┌─────────────────────────────────┐
│ ← 목록으로                       │
├─────────────────────────────────┤
│      ImageGallery               │
│  [img1] [img2] [img3] ...      │
├─────────────────────────────────┤
│ 거래유형 뱃지    가격 정보         │
│                                 │
│ 📍 주소                          │
│ 면적: 전용 59㎡ / 공급 84㎡       │
│ 층수: 5층                        │
│ 방/욕실: 3방 / 2욕실              │
│                                 │
│ 설명                             │
│ Lorem ipsum...                  │
└─────────────────────────────────┘
```

### `ImageGallery.tsx`
- 이미지 URL 배열을 받아 가로 스크롤 갤러리로 표시
- 이미지 클릭 시 확대(모달) — CSS만으로 구현 (라이브러리 사용하지 않음)
- 이미지 0개일 경우 "등록된 사진이 없습니다" placeholder

### `page.tsx`
- `fetch('/api/listings/[id]')`로 단건 조회
- 존재하지 않는 매물이면 `notFound()` 호출 (Next.js 404)
- 가격 표시 규칙:
  - 매매: `매매 {price}만원`
  - 전세: `전세 {price}만원`
  - 월세: `월세 {price}/{monthlyRent}만원`
- "← 목록으로" 링크: `next/link`로 `/`로 이동

### 스타일링
- Tailwind CSS
- 반응형: 모바일에서도 읽기 편한 단일 컬럼 레이아웃

## 입출력

- **입력**: URL의 `[id]` 파라미터 → `GET /api/listings/[id]` 응답
- **출력**: 매물 상세 정보 화면

## 완료 조건

- [ ] `/listings/[id]` 접속 시 매물 상세 정보 표시
- [ ] 이미지 갤러리 동작 (스크롤, 클릭 확대)
- [ ] 가격 표시 규칙 (매매/전세/월세) 정확히 적용
- [ ] 존재하지 않는 id 접속 시 404 페이지
- [ ] "목록으로" 링크 동작
- [ ] 모바일 반응형
