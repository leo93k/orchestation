---
id: TASK-225
title: AppShell-empty-catch-블록-주석-추가
status: in_progress
branch: task/task-225
worktree: ../repo-wt-task-225
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
---
`AppShell.tsx:280`에서 `catch {}` 블록이 주석 없이 에러를 무시하고 있음. 코드베이스의 다른 catch 블록들은 `/* ignore */` 주석을 포함하고 있으나, 이 부분만 누락됨. ESLint `no-empty` 규칙 위반.

## Completion Criteria
- `catch {}` → `catch { /* ignore */ }` 주석 추가
- 기존 로직 변경 없음
