# 코드 분석 보고서: notices/[id]/route.ts 에러 핸들링 누락

## 대상 파일
- `src/frontend/src/app/api/notices/[id]/route.ts`

## 발견 이슈
DELETE 핸들러(L64)에서 `fs.unlinkSync(filePath)` 호출 시 try-catch가 없음.
`findNoticeFile`로 경로 존재를 확인하지만, 확인 시점과 삭제 시점 사이에
파일이 제거될 수 있어(TOCTOU) 서버 크래시 가능.

PUT 핸들러(L30, L51)의 `readFileSync`/`writeFileSync`도 동일한 문제 존재.

## 권장 수정
- DELETE: `fs.unlinkSync`를 try-catch로 감싸고 실패 시 500 응답 반환
- PUT: 파일 I/O를 try-catch로 감싸고 실패 시 500 응답 반환

## 영향도
- 경미 (런타임 예외 → unhandled rejection으로 프로세스 불안정)
