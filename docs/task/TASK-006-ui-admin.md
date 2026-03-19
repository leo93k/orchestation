---
id: TASK-006
title: 관리자 매물 관리 페이지 UI 구현
status: backlog
priority: medium
depends_on:
  - TASK-002
blocks: []
parallel_with:
  - TASK-004
  - TASK-005
owner: ""
branch: task/TASK-006-ui-admin
worktree: ../repo-wt-TASK-006
reviewer: ""
affected_files:
  - src/app/admin/page.tsx
  - src/app/admin/listings/new/page.tsx
  - src/app/admin/listings/[id]/edit/page.tsx
  - src/components/ListingForm.tsx
---

## 무엇을

관리자 매물 CRUD 페이지(`/admin`)를 구현한다. 인증 없이 접근 가능 (MVP).

### 생성할 파일
- `src/app/admin/page.tsx` — 관리자 매물 목록 (테이블)
- `src/app/admin/listings/new/page.tsx` — 매물 등록 페이지
- `src/app/admin/listings/[id]/edit/page.tsx` — 매물 수정 페이지
- `src/components/ListingForm.tsx` — 등록/수정 공용 폼 컴포넌트

## 어떻게

### `/admin` 관리자 목록 페이지
- 매물을 테이블로 표시 (제목, 거래유형, 가격, 지역, 등록일)
- 각 행에 [수정] [삭제] 버튼
- 상단에 [새 매물 등록] 버튼 → `/admin/listings/new`로 이동
- 삭제 클릭 시 `confirm("정말 삭제하시겠습니까?")` 후 `DELETE /api/listings/[id]` 호출
- 삭제 후 목록 자동 갱신

### `ListingForm.tsx` (공용 폼)
- mode prop: `"create"` | `"edit"`
- edit 모드일 때 기존 데이터를 폼에 채워서 표시

| 필드 | 입력 타입 | 필수 | 비고 |
|------|-----------|------|------|
| title | text input | O | |
| description | textarea | O | |
| images | text input (여러 줄) | X | URL을 줄바꿈으로 구분하여 입력 |
| dealType | select | O | SALE/JEONSE/MONTHLY |
| price | number input | O | 만원 단위 |
| monthlyRent | number input | X | dealType이 MONTHLY일 때만 표시 |
| areaExclusive | number input | O | ㎡ |
| areaSupply | number input | O | ㎡ |
| regionSi | text input | O | |
| regionGu | text input | O | |
| regionDong | text input | O | |
| address | text input | O | |
| floor | number input | O | |
| rooms | number input | O | |
| bathrooms | number input | O | |

- 제출 시:
  - create → `POST /api/listings` → 성공 시 `/admin`으로 이동
  - edit → `PUT /api/listings/[id]` → 성공 시 `/admin`으로 이동
- 필수 필드 빈칸일 경우 클라이언트 사이드 밸리데이션 (HTML required 속성)

### 스타일링
- Tailwind CSS
- 심플한 관리자 UI (디자인보다 기능 중심)

## 입출력

- **입력**: 관리자가 폼에 입력한 매물 정보
- **출력**: API 호출 → 매물 생성/수정/삭제 반영

## 완료 조건

- [ ] `/admin` 접속 시 매물 테이블 표시
- [ ] [새 매물 등록] → 폼 작성 → 제출 → 목록에 반영
- [ ] [수정] → 기존 데이터 채워진 폼 → 수정 → 반영
- [ ] [삭제] → 확인 → 삭제 → 목록에서 제거
- [ ] dealType이 MONTHLY일 때만 monthlyRent 입력 필드 표시
- [ ] 필수 필드 빈칸 시 제출 불가
