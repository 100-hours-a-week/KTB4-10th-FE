# 프론트엔드 기여 가이드

## 브랜치

`main → dev → 작업 브랜치` 흐름을 사용합니다.

| 브랜치 | 용도 |
|---|---|
| `main` | 배포 가능한 안정 버전 |
| `dev` | 다음 배포 내용을 통합하는 브랜치 |
| `feat/*` | 화면과 기능 구현 |
| `fix/*` | 버그 수정 |
| `refactor/*` | 동작을 바꾸지 않는 구조 개선 |
| `test/*` | 테스트 추가 |
| `docs/*` | 문서 변경 |
| `chore/*` | 빌드·도구·환경 설정 |

브랜치 이름은 `<type>/<issue-number>-<short-description>` 형식을 사용합니다.

## 작업 흐름

1. Issue를 생성합니다.
2. 최신 `dev`에서 작업 브랜치를 만듭니다.
3. 구현과 필요한 테스트·문서를 함께 변경합니다.
4. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`를 실행합니다.
5. 작업 브랜치를 push하고 `dev` 대상 Draft PR을 만듭니다.
6. 리뷰와 CI 통과 후 Squash Merge하고 작업 브랜치를 삭제합니다.

`main`과 `dev`에는 직접 push하지 않습니다.

## 커밋과 PR 제목

```text
<type>(<scope>): <한글 설명>
```

예시:

```text
feat(auth): 카카오 로그인 완료 흐름 구현
feat(preference): 취향 선택과 전체 저장 구현
test(guidebook): 생성 상태 폴링 테스트 추가
chore: React V1 개발 환경 구성
```

하나의 PR은 하나의 Issue와 주요 목적을 해결합니다. 기능과 무관한 리팩터링을 함께 넣지 않습니다.

## 프론트엔드 기준

- API 응답 타입은 백엔드 `dev`의 실제 DTO와 명세를 함께 확인합니다.
- 서버 데이터를 임의로 화면 모델과 동일하다고 가정하지 않고 API 계층에서 변환합니다.
- 세션 원문, OAuth 코드, CSRF 값과 개인정보를 로그에 남기지 않습니다.
- Figma의 픽셀을 그대로 복사하기 전에 공통 색상·간격·타이포그래피를 확인합니다.
- 접근 가능한 HTML 요소와 키보드 동작을 우선하고 클릭 가능한 `div`를 만들지 않습니다.
