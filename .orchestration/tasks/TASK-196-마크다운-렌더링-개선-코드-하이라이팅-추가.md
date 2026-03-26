---
id: TASK-196
title: 마크다운 렌더링 개선 — 코드 하이라이팅, 체크박스, 테이블 등
status: in_progress
branch: task/task-196
worktree: ../repo-wt-task-196
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/components/MarkdownContent.tsx
  - src/frontend/src/app/globals.css
  - src/frontend/package.json
---

## 현상
- 마크다운이 기본 텍스트처럼 렌더링됨
- 코드 블록에 syntax highlighting 없음 (생 텍스트)
- 체크박스(- [ ]) 가 텍스트로만 표시
- 테이블, 인용문 등 스타일 부족

## 수정 방향
- react-syntax-highlighter 또는 rehype-highlight 설치하여 코드 하이라이팅
- 다크 테마 코드 블록 (One Dark, GitHub Dark 등)
- GFM 체크박스 렌더링
- 테이블 스타일 (border, stripe)
- 인용문, 리스트, 헤딩 스타일 개선
- MarkdownContent 공통 컴포넌트에 적용 (Content 탭, AI Result 탭, Description 등 전체 적용)

## 라이브러리 후보
- rehype-highlight + highlight.js (경량)
- react-syntax-highlighter + prism (기능 풍부)
- rehype-prism-plus (rehype 플러그인)

## Completion Criteria
- 코드 블록에 언어별 syntax highlighting
- 체크박스 렌더링
- 테이블 border + stripe
- 다크 테마 일관성
- 기존 MarkdownContent 사용처 전체 적용
