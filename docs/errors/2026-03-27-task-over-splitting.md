# 태스크 과분할 (Over-Splitting) 프로세스 오류

## 요약
"사이드바 메뉴 개선" 요청이 Tasks/Notices 2개 태스크로 불필요하게 분할됨. 같은 사이드바 컴포넌트에 동일한 패턴(chevron arrow 펼침/접힘)을 적용하는 단일 작업임에도 AI가 2개로 쪼갬.

## 문제 상황
- **입력:** "사이드바 메뉴 개선 — Tasks에 arrow 추가, Notices에도 arrow 추가"
- **기대 결과:** 1개 태스크 (같은 컴포넌트, 같은 패턴, scope 겹침)
- **실제 결과:** 2개 태스크 (Step 1: Tasks arrow, Step 2: Notices arrow)

## 근본 원인

`src/frontend/src/app/api/tasks/analyze/route.ts`의 분석 프롬프트(line 37-48)에 **분할 기준이 너무 느슨함.**

현재 규칙:
```
If the request is simple, return 1 task. If complex, split into 2-5 tasks.
```

이 규칙에는 다음이 빠져 있다:
1. **같은 컴포넌트/파일을 수정하는 작업은 합쳐야 한다**는 기준 없음
2. **동일 패턴 반복 적용은 1개 태스크**라는 판단 기준 없음
3. **scope가 겹치면 분할하지 말 것**이라는 제약 없음

AI는 "Tasks에 arrow" + "Notices에 arrow"를 표면적으로 2개 대상이라 판단하고 분할했지만, 실제로는:
- 사이드바 컴포넌트(`src/frontend/src/components/**`)를 공유
- chevron arrow + 토글 로직이 동일 패턴
- 한 번에 구현해야 시각적 일관성 보장

## 문제의 영향
- 동일 파일을 2개 태스크가 순차 수정 → 불필요한 의존성 발생
- 워커가 같은 컴포넌트를 두 번 읽고 두 번 수정 → 비용/시간 낭비
- 두 번째 태스크가 첫 번째 결과에 의존하므로 병렬 실행 불가

## 권장 수정 방향
프롬프트에 분할 제약 조건 추가:
- scope가 겹치는 작업은 1개 태스크로 유지
- 동일 패턴을 여러 대상에 적용하는 경우 분할하지 않음
- "대상이 여러 개"와 "작업이 여러 개"를 구분하는 기준 명시

## 개선안

### 1. 프롬프트 분할 규칙 강화

현재 프롬프트의 분할 규칙이 단 1줄이다:
```
If the request is simple, return 1 task. If complex, split into 2-5 tasks.
```

아래와 같이 **합쳐야 하는 조건(DO NOT split)**을 명시적으로 추가한다:

```
Split rules:
- If the request is simple, return 1 task. If complex, split into 2-5 tasks.
- DO NOT split when:
  (a) Tasks would modify the same files or overlapping directories
  (b) The same pattern/logic is applied to multiple targets (e.g. "add arrow to A and B" = 1 task)
  (c) Visual/behavioral consistency requires changes to be made together
- DO split when:
  (a) Tasks involve genuinely different layers (e.g. backend API + frontend UI)
  (b) Tasks can run in parallel with zero file overlap
  (c) One task's output is a prerequisite the other consumes (e.g. DB migration → API endpoint)
```

### 2. scope 중복 검증 로직 추가 (후처리)

AI가 2개 이상 태스크를 반환했을 때, API 응답 전에 scope 중복을 검사한다:
- 태스크 간 scope glob이 겹치면 사용자에게 경고 표시 (e.g. "이 태스크들은 같은 파일을 수정합니다. 합칠까요?")
- 자동 병합은 하지 않되, UI에서 합치기 버튼을 제공

```
[Step 1] src/frontend/src/components/**  ← 겹침 감지
[Step 2] src/frontend/src/components/**  ← 겹침 감지
⚠️ Step 1과 Step 2의 scope가 겹칩니다. 하나로 합치는 것을 권장합니다. [합치기]
```

### 3. 분할 판단 기준 문서화

`docs/prd/` 또는 `docs/roles/`에 태스크 분할 가이드라인을 문서화하여, 프롬프트 수정 시 참조할 수 있게 한다:

| 분할 O | 분할 X |
|--------|--------|
| 백엔드 API + 프론트엔드 UI | 같은 컴포넌트에 같은 패턴 반복 |
| DB 스키마 변경 + 마이그레이션 스크립트 | scope가 겹치는 UI 변경 |
| 독립적인 모듈 2개 수정 | A에 적용 + B에도 동일 적용 |

### 우선순위
1. **(즉시)** 프롬프트 규칙 강화 — 가장 적은 코드 변경으로 효과 큼
2. **(다음)** scope 중복 경고 UI — 프롬프트가 놓치는 케이스 방어
3. **(나중)** 분할 가이드라인 문서화 — 장기적 품질 유지
