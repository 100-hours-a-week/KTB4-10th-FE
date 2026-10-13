# 프론트엔드 기여 가이드

## 1. 기본 원칙

- `main → dev → 작업 브랜치` 흐름을 사용한다.
- `main`과 `dev`에는 직접 push하거나 force push하지 않는다.
- 한 Issue는 가능하면 한 사람이 1~3일 안에 하나의 PR로 완료할 수 있게 나눈다.
- 한 PR은 하나의 Issue와 주요 목적만 해결한다.
- API나 사용자 흐름이 바뀌면 같은 PR에서 관련 V1 문서를 갱신한다.

## 2. 작업 흐름

1. 작업할 내용의 Issue를 생성한다.
2. `git fetch origin dev` 후 최신 `origin/dev`에서 작업 브랜치를 만든다.
3. 구현, 테스트와 필요한 문서 수정을 진행한다.
4. 방향을 일찍 공유할 필요가 있으면 Draft PR을 생성한다.
5. `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`를 각각 실행한다.
6. 작업 브랜치에서 `dev` 대상 PR을 만들고 상대 팀원에게 리뷰를 요청한다.
7. 필수 CI 통과 후 Squash Merge하고 작업 브랜치를 삭제한다. 리뷰 승인은 권장하지만 병합 필수 조건은 아니다.
8. 검증된 기능 묶음은 `dev → main` PR로 배포한다.

GitHub 기본 브랜치가 `main`이므로 `dev` 대상 PR의 `Close #번호`만으로 Issue가 즉시 닫히지 않는다. 저장소 워크플로가 PR 병합 후 브랜치 번호와 본문의 `Close #번호`가 일치할 때만 Issue를 완료 처리한다.

## 3. 브랜치·Issue 규칙

브랜치는 `<type>/<issue-number>-<lowercase-kebab-case>` 형식이다.

```text
feat/83-add-map-filter
fix/84-auth-transition
docs/85-update-v1-flow
```

Issue 제목은 `[type][domain] 작업 요약` 형식이다.

### 3.1 Type

| 의미 | 제목 type | Label | 브랜치·커밋 type |
| --- | --- | --- | --- |
| 기능 | `feature` | `feature` | `feat` |
| 버그 | `bug` | `bug` | `fix` |
| 리팩터링 | `refactor` | `refactor` | `refactor` |
| 테스트 | `test` | `test` | `test` |
| 문서 | `docs` | `documentation` | `docs` |
| 작업 | `chore` | `chore` | `chore` |
| CI | `ci` | `ci` | `ci` |

### 3.2 Domain

| 의미 | 제목 domain | Label |
| --- | --- | --- |
| 회원·인증·취향·알림·설정 | `member` | `domain:member` |
| 지도·관광 콘텐츠·관심 장소 | `content` | `domain:content` |
| 가이드북 생성·조회 | `guidebook` | `domain:guidebook` |
| 평가 | `rating` | `domain:rating` |
| 생성권·쿠폰 | `credit` | `domain:credit` |
| 공통 API·UI·라우팅·테스트 환경 | `common` | `domain:common` |
| 빌드·배포·분석·환경 | `infra` | `domain:infra` |

목록에 없는 영역은 임의 생성하지 않고 팀 합의 후 문서와 bootstrap 스크립트를 함께 바꾼다.

### 3.3 저장소 공용 자동화

- `$create-github-issue`: 표준 Issue를 만들고 최신 `origin/dev` 기반 로컬 브랜치를 생성한다.
- `$create-github-pr`: 연결 Issue를 확인하거나 생성하고 필수 검사 후 push와 Draft PR을 수행한다.
- 최초 label 구성: `.agents/skills/create-github-issue/scripts/bootstrap-labels.sh`

## 4. 커밋과 PR 제목

```text
<type>(<scope>): <한글 설명>
```

```text
feat(auth): 카카오 로그인 완료 흐름 구현
fix(map): 위치 권한 거절 시 기본 중심 이동
test(guidebook): 생성 상태 폴링 테스트 추가
chore(ci): 프론트 필수 검사 추가
```

PR 본문에는 `Close #번호`, 변경 이유, 검사 결과, 영향 범위와 리뷰 포인트를 적는다. PR 작성자와 reviewer는 서로 다른 GitHub 사용자여야 한다.

## 5. 프론트엔드 구현 기준

- API 응답 타입은 BE `dev`의 실제 DTO와 명세를 함께 확인한다.
- 서버 DTO를 화면 모델과 같다고 가정하지 않고 API 계층에서 검증·변환한다.
- API 호출은 `features/<domain>/api`에 모으고 컴포넌트는 사용자 상태와 상호작용에 집중한다.
- 로딩, 성공, 빈 결과, 실패와 재시도 상태를 필요한 수준으로 다룬다.
- 인증 정보는 JavaScript 저장소에 복제하지 않는다. 세션 쿠키와 CSRF 계약을 따른다.
- 세션, OAuth 코드, CSRF 값, 개인정보를 로그나 Issue·PR에 남기지 않는다.
- 모바일 웹 앱을 기준으로 최신 Chrome, Safari, Edge를 지원하며 Internet Explorer용 polyfill은 제공하지 않는다.
- 접근 가능한 HTML 요소와 키보드 동작을 우선하고 클릭 가능한 `div`를 만들지 않는다.
- Figma 픽셀을 복사하기 전에 공통 색상·간격·타이포그래피와 모바일 safe area를 확인한다.

## 6. 테스트 기준

- 순수 함수: 입력, 경계값과 오류를 단위 테스트한다.
- 컴포넌트: 내부 구현보다 사용자 행동과 화면 결과를 검증한다.
- API 계층: 성공 계약, 대표 오류와 인증·CSRF 상태를 검증한다.
- 라우팅: 비로그인, `ONBOARDING`, `ACTIVE`, 세션 만료 분기를 검증한다.
- 핵심 흐름은 실제 브라우저에서 로그인 → 취향 → 지도/가이드북 → 로그아웃까지 확인한다.

모든 내부 코드를 테스트하지 않고 실패하면 사용자 흐름이나 데이터 계약이 깨지는 부분을 우선한다.
