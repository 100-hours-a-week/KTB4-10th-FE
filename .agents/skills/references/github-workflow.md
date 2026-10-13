# GitHub workflow policy

## Repository

- Repository: `100-hours-a-week/KTB4-10th-FE`
- Default PR base: `dev`
- Merge method: Squash Merge
- Issue title: `[<type key>][<domain key>] <Korean summary>`
- Branch: `<branch type>/<issue number>-<lowercase kebab-case slug>`
- PR title: `<commit type>(<scope>): <Korean summary>`
- Pair: `dwkim0512` and `Yonduss`

## Type mapping

| 의미 | 제목 type | Label | 브랜치·커밋 type |
| --- | --- | --- | --- |
| 기능 | `feature` | `feature` | `feat` |
| 버그 | `bug` | `bug` | `fix` |
| 리팩터링 | `refactor` | `refactor` | `refactor` |
| 테스트 | `test` | `test` | `test` |
| 문서 | `docs` | `documentation` | `docs` |
| 작업 | `chore` | `chore` | `chore` |
| CI | `ci` | `ci` | `ci` |

## Domain mapping

BE와 FE Issue를 같은 영역으로 검색할 수 있도록 domain key를 공유한다.

| 의미 | 제목 domain | Label | FE 예시 |
| --- | --- | --- | --- |
| 회원 | `member` | `domain:member` | 인증, 취향, 마이페이지, 알림, 설정 |
| 관광 콘텐츠 | `content` | `domain:content` | 지도, 마커, 행사, 관심 장소 |
| 가이드북 | `guidebook` | `domain:guidebook` | 생성, 폴링, 목록, 상세, 뷰어 |
| 평가 | `rating` | `domain:rating` | 평가 입력과 결과 화면 |
| 생성권 | `credit` | `domain:credit` | 잔액, 쿠폰, 생성 가능 상태 |
| 공통 | `common` | `domain:common` | 공통 API, UI, 라우팅, 테스트 환경 |
| 인프라 | `infra` | `domain:infra` | 빌드, 배포, 분석, 환경 변수 |

목록에 없는 domain은 임의로 만들지 않는다. 어느 domain에도 맞지 않으면 팀 합의 후 이 표와 label bootstrap 스크립트를 함께 수정한다.

## Pair review defaults

- assignee가 `dwkim0512`이면 기본 reviewer는 `Yonduss`다.
- assignee가 `Yonduss`이면 기본 reviewer는 `dwkim0512`다.
- reviewer 요청은 기본값이지만 승인은 병합 필수 조건이 아니다.
- 사용자가 reviewer를 지정하거나 생략을 요청하면 그 지시를 따른다.

## Shared safety rules

GitHub 변경은 이 저장소에서 실행하고 mutation 전에 다음을 확인한다.

1. `gh auth status`가 성공한다.
2. `gh repo view 100-hours-a-week/KTB4-10th-FE --json viewerPermission --jq .viewerPermission`이 `WRITE`, `MAINTAIN`, `ADMIN` 중 하나다.
3. assignee와 reviewer가 유효하고 reviewer는 assignee와 다르다.
4. 필요한 type·domain label이 저장소에 존재한다.

인증, 권한, 사용자, reviewer, label 확인이 실패하면 GitHub 상태를 변경하지 않고 해결 방법을 보고한다. 일반 Issue·PR 요청 중 label을 임의 생성하지 않는다. multiline 본문은 `mktemp`로 만든 정확한 임시 파일을 사용하고 비밀키, OAuth 원문, 개인정보를 기록하지 않는다.
