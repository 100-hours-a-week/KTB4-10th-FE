# KGB Frontend

KGB V1 웹앱 프론트엔드입니다. 화면 구현은 Figma V1 프레임을 기준으로 하고, API 계약은 `KTB4-10th-BE`의 최신 `dev`를 기준으로 맞춥니다.

## 화면 지원 범위

- 본 서비스는 모바일 중심 SPA 웹 애플리케이션입니다.
- 모바일에서는 기기 화면 너비를 사용하고 노치·홈 인디케이터 등 안전 영역을 반영합니다.
- 데스크톱과 태블릿에서는 모바일 앱 셸을 화면 중앙에 표시합니다.
- V1부터 V3까지 데스크톱 전용 확장 레이아웃은 제공하지 않습니다.
- 최신 Chrome, Safari, Edge를 지원 대상으로 하며 Internet Explorer는 지원하지 않습니다.
- 브라우저에서 실행되는 웹 앱이며, manifest·Service Worker·설치 기능이 추가되기 전까지 PWA로 취급하지 않습니다.

## 기술 구성

- React 19, TypeScript, Vite
- React Router
- Axios
- Vitest, Testing Library
- Oxlint

서버 상태 관리, 전역 상태 관리, UI 프레임워크는 현재 추가하지 않았습니다. 실제 화면을 구현하면서 공통 상태와 반복 코드가 확인되면 별도 Issue에서 도입 여부를 결정합니다.

## 실행 환경

- Node.js 22.12 이상 (`.nvmrc` 기준 개발 버전은 24)
- npm 10 이상
- 로컬 백엔드 기본 주소: `http://localhost:8080`

```bash
npm install
cp .env.example .env.local
npm run dev
```

기본 개발 서버는 `http://localhost:5173`입니다. 쿠키 host가 달라지는 문제를 피하기 위해 FE와 BE 모두 `localhost`를 사용하고 `127.0.0.1`과 섞지 않습니다.

## 환경변수

| 이름 | 설명 | 로컬 예시 |
|---|---|---|
| `VITE_API_BASE_URL` | 백엔드 API 기준 URL. 로컬은 Vite 프록시, 배포는 동일 Origin 프록시를 사용하므로 기본값은 빈 문자열 | 빈 문자열 |

실제 키·토큰·비밀값은 `.env*`에 커밋하지 않습니다. Vite의 `VITE_` 변수는 브라우저 번들에 노출되므로 공개 가능한 설정만 넣습니다.

로컬 개발 서버는 `/api/**` 요청을 `http://localhost:8080`으로 프록시합니다. 따라서 FE 요청은 `localhost:5173`의 같은 Origin으로 보내고, 브라우저 CORS 설정에 의존하지 않습니다. BE를 먼저 8080 포트에서 실행해야 정책과 로그인 API가 정상 동작합니다.

## API 기본 계약

- Axios는 `withCredentials=true`로 `KGB_SESSION` 쿠키를 백엔드에 전달합니다.
- 상태 변경 요청은 백엔드가 발급한 `XSRF-TOKEN` 쿠키 값을 `X-XSRF-TOKEN` 헤더로 전달합니다.
- 로그인 시작은 백엔드의 `GET /api/v1/auth/oauth/authorize/kakao`로 브라우저를 이동시킵니다.
- 로그인 완료 후 `GET /api/v1/members/me`를 호출하고 `ONBOARDING`이면 취향 선택, `ACTIVE`이면 서비스 화면으로 이동합니다.

BE OAuth 리다이렉트는 실행 환경에 맞춰 다음처럼 설정합니다.

```text
OAUTH_SUCCESS_REDIRECT_URI=http://localhost:5173/auth/complete
OAUTH_FAILURE_REDIRECT_URI=http://localhost:5173/auth/error
```

배포 환경에서는 위 host를 실제 FE 주소로 교체합니다. 카카오 인가·콜백은 BE가 처리하므로 REST API 키나 Client Secret을 FE 환경변수에 넣지 않습니다.

## 명령어

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run build
npm run preview
```

## 디렉터리

```text
src/
├── app/             # 앱 진입점과 라우팅
├── pages/           # URL 단위 화면
├── shared/
│   ├── api/         # 공통 HTTP 클라이언트
│   └── config/      # 라우트·환경 설정
├── styles/          # 전역 스타일
└── test/            # 테스트 공통 설정
```

도메인 화면 구현이 시작되면 `features/auth`, `features/preference`, `features/guidebook`처럼 사용자 기능 단위로 추가합니다. 처음부터 모든 계층 폴더를 만들지 않고 실제 코드가 생길 때 확장합니다.

## 개발 순서

후속 작업과 의존 관계는 [V1 프론트엔드 백로그](docs/V1_FE_BACKLOG.md)를 따릅니다.
