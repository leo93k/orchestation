# context glob 패턴이 build_layered_context에서 파일로 resolve 안 되는 문제 (2026-03-27)

## 요약
태스크 frontmatter에 `context: scripts/**`를 넣었는데, `build_layered_context()`가 glob 패턴을 실제 파일로 resolve하지 못하고 `scripts/**: No such file or directory` 에러 발생.

## 증상
```
/scripts/lib/context-builder.sh: line 214: scripts/**: No such file or directory
/scripts/lib/context-builder.sh: line 216: [: : integer expression expected
```

## 근본 원인
`build_layered_context()`에서 glob 패턴(`scripts/**`)을 그대로 파일 경로로 취급하여 `wc -l < "scripts/**"`를 실행. glob이 expand되지 않아 에러.

이전에 scope에서도 같은 문제가 있었고, `build_layered_context()`에 glob → 실제 파일 resolve 로직을 추가했었음. 하지만 그 로직이 **scope에만 적용**되고, 새로 추가한 **context 경로에는 같은 함수를 쓰면서도 worktree 경로가 제대로 전달되지 않는** 문제.

## 영향
- context 파일이 프롬프트에 임베드되지 않음
- 워커가 참조 파일 없이 작업 → context 추가의 효과가 없음
- 워커가 자체적으로 `find`/`ls`로 파일을 찾으면 동작은 하지만 턴 낭비

## 개선안
`build_layered_context()`에 worktree 경로를 전달하여 glob resolve가 정상 동작하도록 수정. 또는 context용 `build_layered_context` 호출 시 worktree 경로를 명시적으로 전달.
