# 오케스트레이션 대시보드

## 목표

AI 에이전트 기반 태스크 오케스트레이션 시스템. Claude CLI를 활용하여 소프트웨어 개발 태스크를 자동으로 실행하고, 리뷰하고, 머지하는 파이프라인을 구축한다.

## 핵심 기능

- **태스크 오케스트레이션**: docs/task/*.md 기반 태스크를 의존 관계에 따라 병렬/순차 실행
- **자동 코드 리뷰**: 작업 완료 후 리뷰어 에이전트가 완료 조건 검증
- **웹 대시보드**: Task, Sprint, Docs, Cost, Terminal을 한 화면에서 관리
- **비용 모니터링**: 토큰 사용량, 비용, 시간 추적

## 기술 스택

- **프론트엔드**: Next.js 15, React, Tailwind CSS, Radix UI
- **백엔드**: Node.js, Claude CLI
- **에이전트**: Claude Sonnet 4.6 (기본), Claude Opus 4.6 (복잡한 태스크)
- **데이터**: Markdown frontmatter 기반 (DB 없음)

## 문서 구조

```
docs/
├── prd/         # 프로젝트 문서 (이 폴더)
├── sprint/      # Sprint 정의
├── task/        # Task 정의
├── roles/       # 역할 프롬프트
└── plan/        # 실행 계획
```

## 설계 원칙

- **Sprint 개념 없음**: 태스크는 TASK-*로만 관리한다. Sprint 개념은 사용하지 않는다.
- **REQ-*.md 파일 폐기**: `docs/requests/REQ-*.md` 파일 기반 Request 개념은 폐기되었다. 모든 작업 단위는 `.orchestration/tasks/TASK-*.md`로 통일된다.
- **API 경로 마이그레이션 진행 중**: 태스크 생성/조회는 현재 `/api/requests` 엔드포인트를 통해 이루어지나, 내부적으로는 TASK-*.md를 읽고 쓴다. `/api/tasks`로의 경로 통일은 [TBD] 마이그레이션 예정이다.
- **DB 없음**: 모든 상태는 마크다운 파일 frontmatter에 저장한다.
- **OS PID가 진실**: 오케스트레이션 상태는 PID 생존 여부로 판단한다.
