---
id: TASK-242
title: 미사용-모니터-컴포넌트-CpuChart-SystemInfo-삭제
status: failed
branch: task/task-242
worktree: ../repo-wt-task-242
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/components/monitor/CpuChart.tsx
  - src/frontend/src/components/monitor/SystemInfo.tsx
---
CpuChart와 SystemInfo 컴포넌트가 export되어 있으나 코드베이스 어디에서도 import/사용되지 않는 데드코드입니다. 두 파일을 삭제합니다.

## Completion Criteria
- `src/frontend/src/components/monitor/CpuChart.tsx` 파일 삭제
- `src/frontend/src/components/monitor/SystemInfo.tsx` 파일 삭제
- 빌드(`npm run build`) 정상 통과 확인
