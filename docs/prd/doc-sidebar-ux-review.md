# 사이드바 UX 전수 조사 및 개선안

---

## 1. 전수 조사 — 현재 메뉴 구조

```
Dashboard (홈 링크)
──────────────────
DOCS
  📄 프로젝트 개요
  📁 아키텍처
    📄 시스템 구조
    📄 오케스트레이션 파이프라인
  📁 가이드
    📄 프롬프트 가이드
    📄 역할 프롬프트 가이드
  📁 리서치
    📄 프롬프트 성능 비교 실험 결론
  [+] New Document / New Folder

SPRINTS
  📅 All Sprints              2
    ● S5                    3/3
    ● S6                    2/2
    ● S1                    0/2
    ● S2                    0/8
    ● S3                    0/3
    ● S4                    0/6

TASKS
  All Tasks                    5
  By Status
    ● Backlog                  0
    ● In Progress              0
    ● Done                     5
  By Sprint
    S5                       3/3
    S6                       2/2
    S1                       0/2
    ...

──────────────────
💰 Cost
🖥 Terminal
⚙ Settings
```

### 메뉴별 목적

| 메뉴 | 목적 | 클릭 시 동작 |
|------|------|-------------|
| Dashboard | 홈으로 이동 | `/` (빈 화면) |
| DOCS | 프로젝트 문서 관리 | 트리 탐색 → `/docs/[id]` |
| SPRINTS > All Sprints | Sprint 목록 | `/sprint` |
| SPRINTS > S5, S6... | 개별 Sprint 상세 | `/sprint/[id]` |
| TASKS > All Tasks | 전체 태스크 리스트 | `/` + Task 뷰 |
| TASKS > By Status | 상태별 필터 | `/` + 필터 |
| TASKS > By Sprint | Sprint별 필터 | `/` + 필터 |
| Cost | 비용 모니터링 | `/cost` |
| Terminal | 웹 터미널 | `/terminal` |
| Settings | 설정 | `/settings` |

---

## 2. 정보 구조(IA) 분석

### 중복/충돌

| 문제 | 위치 | 설명 |
|------|------|------|
| **Sprint 중복** | SPRINTS 섹션 + TASKS > By Sprint | 같은 Sprint이 2곳에 표시. 역할은 다르지만 (네비 vs 필터) 사용자에게 혼란 |
| **All Tasks ≠ 홈** | TASKS > All Tasks → `/` | 홈과 같은 path지만 홈은 빈 화면, All Tasks는 태스크 뷰. 같은 URL에 2가지 상태 |
| **Dashboard = 빈 화면** | 최상단 | 클릭하면 아무것도 없음. "Dashboard"라는 이름이 "종합 현황판"을 암시하지만 실제로는 빈 페이지 |

### 멘탈 모델 불일치

- 사용자는 "Dashboard"를 클릭하면 **프로젝트 요약/현황**을 기대함 → 빈 화면 나옴
- "TASKS" 섹션의 "By Sprint" 필터와 "SPRINTS" 섹션이 같은 Sprint을 다른 방식으로 보여줌 → **"Sprint 관련 정보는 어디서 봐야 하지?"** 혼란
- "All Tasks"가 홈(`/`)에서 동작하는데, 홈 진입 시에는 안 보임 → **예측 불가능한 상태**

### 깊이/너비

- **DOCS**: 깊이 3 (섹션 → 폴더 → 문서) — 적절
- **TASKS**: 깊이 3 (섹션 → By Status → 개별 상태) — 적절하나 By Sprint과 SPRINTS 중복
- **전체 너비**: 3개 주요 섹션(DOCS/SPRINTS/TASKS) + 3개 유틸리티(Cost/Terminal/Settings) — 적절

---

## 3. UX 문제 진단

### HIGH — 지금 당장 고쳐야 하는 것

| # | 문제 | 영향 | 해결 방향 |
|---|------|------|----------|
| 1 | **Dashboard 홈이 빈 화면** | 첫 방문자가 "이 서비스 뭐지?" 혼란. 서비스의 첫인상이 "아무것도 없음" | 홈에 프로젝트 요약 대시보드 표시 (Task 상태 요약, Sprint 진행률, 최근 활동) |
| 2 | **같은 URL(/)에 빈 화면/Task 뷰 2가지 상태** | 새로고침하면 빈 화면. 북마크 불가능. 예측 불가 | Task 뷰를 별도 path(`/tasks`)로 분리하거나, 홈을 항상 Task 뷰로 |
| 3 | **Sprint 중복 (SPRINTS + By Sprint)** | "Sprint 5는 어디서 보지?" — 2곳 다 있어서 혼란 | TASKS > By Sprint 제거. Sprint 필터는 SPRINTS 섹션에서만 |

### MEDIUM — 개선하면 좋은 것

| # | 문제 | 영향 | 해결 방향 |
|---|------|------|----------|
| 4 | **"All Sprints" 메뉴 필요성** | Sprint이 6개뿐인데 "All Sprints" 별도 페이지가 필요한가? 아코디언으로 이미 펼쳐볼 수 있음 | Sprint 목록을 사이드바에서 직접 관리. "All Sprints"는 Sprint이 10개 이상일 때만 의미 |
| 5 | **TASKS 섹션이 3개 서브 그룹 (All / By Status / By Sprint)** | 너무 많은 필터 옵션이 사이드바를 차지 | 필터를 사이드바 대신 Task 뷰 상단 필터바에 통합 (이미 있음) |
| 6 | **Cost/Terminal/Settings가 하단에 격리** | 자주 사용하는 기능이 스크롤 아래로 밀림 | 사이드바 접힘 시에도 아이콘으로 접근 가능하도록 |

### LOW — 나중에 해도 되는 것

| # | 문제 | 해결 방향 |
|---|------|----------|
| 7 | Settings 페이지가 빈 껍데기 | 설정 항목이 생기면 채우기 |
| 8 | 모바일 대응 없음 | 사이드바 오버레이/드로어 방식 |

---

## 4. 사용자 시나리오 기반 평가

### 시나리오 A: 처음 방문한 사용자

```
1. 서비스 접속 → 빈 화면 ❌ "뭐지?"
2. 사이드바 봄 → DOCS/SPRINTS/TASKS/Cost/Terminal → "뭐부터 눌러야 하지?"
3. Dashboard 클릭 → 빈 화면 ❌ "이미 여기잖아"
4. All Tasks 클릭 → Task 뷰 나옴 → "아 이게 메인이구나"
```

**문제**: 홈이 빈 화면이라 첫 방문자가 서비스를 이해할 수 없음. "Dashboard"라는 이름과 실제 콘텐츠 불일치.

### 시나리오 B: 반복 사용 유저 (매일 사용)

```
1. 접속 → 빈 화면 → 매번 "All Tasks" 클릭 ❌ 불필요한 1클릭
2. Sprint 진행 확인 → SPRINTS에서 S6 클릭 → /sprint/SPRINT-006
3. 같은 Sprint의 Task 필터 → 뒤로 → TASKS > By Sprint > S6 ❌ 다른 곳에서 또 같은 Sprint
```

**문제**: 매번 All Tasks 클릭 필요. Sprint을 2곳에서 찾아야 함.

### 시나리오 C: 특정 기능만 빠르게 (비용 확인)

```
1. Cost 클릭 → 비용 페이지 ✅ 1클릭
```

**문제 없음**: 유틸리티 메뉴는 잘 작동.

---

## 5. 개선안

### Before

```
Dashboard (빈 화면)
────────────────
DOCS (문서 트리)
SPRINTS (All + 개별)
TASKS (All + By Status + By Sprint)  ← Sprint 중복
────────────────
Cost / Terminal / Settings
```

### After

```
Dashboard (프로젝트 요약)
────────────────
DOCS (문서 트리 — 유지)
SPRINTS (All + 개별 — 유지)
TASKS (All + By Status)              ← By Sprint 제거
────────────────
Cost / Terminal / Settings
```

### 변경 상세

| # | 변경 | 이유 |
|---|------|------|
| 1 | **홈을 Task 뷰로 변경** (또는 프로젝트 요약) | 빈 화면 제거, 매번 클릭 1회 절약 |
| 2 | **TASKS > By Sprint 제거** | SPRINTS 섹션과 중복. Sprint별 Task는 Sprint 상세에서 확인 |
| 3 | **"Dashboard" → "Home" 또는 프로젝트명** | "Dashboard"는 종합 현황을 기대하게 함 |
| 4 | 향후: 홈에 **프로젝트 요약** 위젯 | Task 상태 분포, Sprint 진행률, 최근 비용 |

### 네이밍 개선

| Before | After | 이유 |
|--------|-------|------|
| Dashboard | **프로젝트명** 또는 Home | Dashboard는 콘텐츠가 있어야 의미 |
| All Sprints | **Sprints** (섹션 헤더로 통합) | 별도 메뉴 불필요 |
| All Tasks | **Tasks** (섹션 헤더 클릭으로) | 동일 |
| By Status / By Sprint | 제거 → 필터바에 통합 | 사이드바 간소화 |

### 클릭 수 감소

| 행동 | Before | After |
|------|--------|-------|
| Task 목록 보기 | 2클릭 (접속 → All Tasks) | **0클릭** (홈이 Task 뷰) |
| Sprint 5의 Task 보기 | 3클릭 (TASKS → By Sprint → S5) | **1클릭** (SPRINTS > S5) |

---

## 6. 추가 UX 제안

### 사이드바 토글

- **사이드바 접힘/펼침 버튼** 추가 (좌하단 또는 상단)
- 접힌 상태에서는 아이콘만 표시
- `Cmd+B` 단축키로 토글

### hover/active 상태

- 현재 잘 되어 있음 (`.tree-item:hover`, `.tree-item.active`)
- 개선: active 상태에 **좌측 액센트 바** 추가 (2px border-left primary)

### "현재 위치" 표시

- 현재: active 클래스로 배경색 변경 — 적절
- 개선: **breadcrumb을 검색 헤더 영역에 표시** (현재는 콘텐츠 내부에만 있음)

### 모바일 대응

- 사이드바를 **드로어(overlay)** 방식으로 전환
- 햄버거 메뉴 버튼 (좌상단)
- 메뉴 선택 시 자동 닫힘

---

## 7. 실행 우선순위

### 🔴 High — 지금 고쳐야

1. **홈 빈 화면 제거** → 홈을 Task 뷰로 (또는 프로젝트 요약)
2. **TASKS > By Sprint 제거** → Sprint 중복 해소
3. **같은 URL 2상태 문제 해결** → Task 뷰를 홈 기본으로

### 🟡 Medium — 개선하면 좋은

4. **사이드바 접힘/펼침** 기능
5. **active 상태에 좌측 액센트 바** 추가
6. **Dashboard → Home 또는 프로젝트명** 네이밍 변경

### 🟢 Low — 나중에

7. Settings 페이지 내용 채우기
8. 모바일 드로어 대응
9. 검색 헤더에 breadcrumb 통합
