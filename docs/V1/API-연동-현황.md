# V1 API 연동 현황과 화면 유즈케이스

이 문서는 FE가 현재 호출하는 API를 사용자 행동과 화면 기준으로 정리한다. 기본 prefix는 `/api/v1`이다.

## 공통 계약

- Axios 인스턴스는 `withCredentials: true`로 서비스 세션 쿠키를 전달한다.
- 상태 변경 요청은 먼저 `GET /auth/csrf`로 CSRF cookie를 준비하고 `X-XSRF-TOKEN` header를 보낸다.
- 성공 응답은 `{ message, data }`, 실패 응답은 `{ message, data: null, error }` 형태로 구분한다.
- `401`은 세션 만료로 처리하고, 네트워크 오류·5xx는 세션 만료로 단정하지 않는다.
- 회원 정보는 현재 탭 메모리에만 캐시하고 401·로그아웃·탈퇴 시 제거한다.

## 1. 로그인·회원·취향

| 사용자 유즈케이스 | Method | Path | FE 사용 위치 | 현재 처리 | 관련 검증 |
| --- | --- | --- | --- | --- | --- |
| 카카오 로그인을 시작한다 | GET 이동 | `/auth/oauth/authorize/kakao` | 로그인 화면 | 브라우저 전체를 BE 인가 시작 경로로 이동한다. | `App.test.tsx` |
| 로그인 완료 후 회원 상태를 확인한다 | GET | `/members/me` | `/`, `/auth/complete`, 보호 라우트, 마이페이지 | `ONBOARDING`은 취향, `ACTIVE`는 지도 또는 요청 화면으로 보낸다. | `AuthBoundary.test.tsx`, `auth.test.ts` |
| 상태 변경용 CSRF 토큰을 준비한다 | GET | `/auth/csrf` | 공통 CSRF 모듈 | 최초 변경 요청 전에 cookie와 header 계약을 초기화한다. | `csrf.test.ts` |
| 선택 가능한 취향을 본다 | GET | `/preference-options` | `/preferences` | 유형·부모 코드·정렬 순서로 선택지를 구성한다. | `PreferenceSelectionPage.test.tsx` |
| 저장한 취향을 본다 | GET | `/members/me/preferences` | 첫 진입 판단, 취향 수정 | 선택값 유무로 온보딩/수정 흐름을 구분한다. | `PreferenceSelectionPage.test.tsx` |
| 취향을 전체 저장한다 | PUT | `/members/me/preferences` | `/preferences` | 전체 선택을 저장하고 응답 상태가 `ACTIVE`면 지도 또는 복귀 경로로 이동한다. | `App.test.tsx`, `PreferenceSelectionPage.test.tsx` |
| 로그아웃한다 | POST | `/auth/logout` | `/mypage/settings` | 현재 브라우저의 Web Push 구독을 해제한 뒤 세션·CSRF·회원 메모리 상태를 비우고 로그인 화면으로 이동한다. | `settings.test.ts`, `SettingsPage.test.tsx` |
| 회원을 탈퇴한다 | DELETE | `/members/me` | `/mypage/settings` | 현재 브라우저의 Web Push 구독을 해제하고 확인 문구 검증 후 탈퇴한다. | `SettingsPage.test.tsx` |

## 2. 지도·관심 장소·설정

| 사용자 유즈케이스 | Method | Path | FE 사용 위치 | 현재 처리 | 관련 검증 |
| --- | --- | --- | --- | --- | --- |
| 현재 지도 영역의 콘텐츠를 본다 | GET | `/map/contents` | `/map` | bounds·zoom·limit로 콘텐츠/클러스터를 요청하고 마커·바텀시트로 표시한다. | `map.test.ts`, `MapPage.test.tsx` |
| 장소를 관심 목록에 추가한다 | PUT | `/members/me/favorites/{contentId}` | 지도 바텀시트 | CSRF 요청 후 현재 카드와 마커의 관심 상태를 갱신한다. | `favorites.test.ts` |
| 장소 관심을 해제한다 | DELETE | `/members/me/favorites/{contentId}` | 지도 바텀시트 | CSRF 요청 후 관심 상태를 해제한다. | `favorites.test.ts` |
| 실시간 알림 수신 의사를 변경한다 | PATCH | `/members/me/settings` | 지도 알림 권한 안내·설정 페이지 | ON이면 사용자 동의로 Web Push 구독을 등록한 뒤 SSE를 열고, OFF이면 능동 전달을 닫는다. DB 알림 저장은 유지한다. | `MapPage.test.tsx`, `SettingsPage.test.tsx`, `webPush.test.ts` |
| 실시간 알림 수신 설정을 확인한다 | GET | `/members/me/settings` | 전역 `NotificationCenter` | `push_enabled=true`인 ACTIVE 회원만 SSE를 열고, 이미 허용된 브라우저 구독을 현재 회원으로 복구한다. 자동 권한 요청은 하지 않는다. | `memberSettings.test.ts`, `NotificationCenter.test.tsx` |
| VAPID 공개키를 조회한다 | GET | `/push/vapid-public-key` | Web Push 구독 모듈 | 새 브라우저 구독을 만들 때만 공개키를 조회한다. 개인키는 FE에서 취급하지 않는다. | `pushSubscriptions.test.ts`, `webPush.test.ts` |
| 현재 브라우저 Push 구독을 등록한다 | PUT | `/members/me/push-subscriptions` | Web Push 구독 모듈 | endpoint·expiration time·p256dh·auth를 CSRF 보호 요청으로 저장하고 기존 구독은 재사용한다. | `pushSubscriptions.test.ts`, `webPush.test.ts` |
| 현재 브라우저 Push 구독을 해제한다 | DELETE | `/members/me/push-subscriptions/{subscriptionId}` | 로그아웃·탈퇴 | 서비스 세션 종료 전에 서버 구독을 해제하고 브라우저에서도 unsubscribe한다. | `pushSubscriptions.test.ts`, `webPush.test.ts`, `settings.test.ts` |

지도 조회는 동일한 bounds·zoom 요청을 탭 메모리에서 5분간 최대 30개 보관하고, 진행 중인 같은 요청을 합친다. 서버 상태 캐시 라이브러리는 사용하지 않는다.

## 3. 가이드북·생성권

| 사용자 유즈케이스 | Method | Path | FE 사용 위치 | 현재 처리 | 관련 검증 |
| --- | --- | --- | --- | --- | --- |
| 생성권 상태를 본다 | GET | `/credits/wallet` | `/guidebooks/new` | 잔액, 활성 작업, 생성 가능 여부로 제출 가능 상태를 결정한다. | `GuidebookPages.test.tsx` |
| 가이드북 생성을 접수한다 | POST | `/guidebook-generations` | `/guidebooks/new` | `Idempotency-Key`, 지역·기간·동행 조건을 CSRF 요청으로 전송한다. | `GuidebookPages.test.tsx` |
| 생성 상태를 확인한다 | GET | `/guidebook-generations/{jobId}` | 전역 `GenerationProvider`, 생성 화면 | 2초 간격으로 조회하며 완료·실패·취소에서 중단한다. | `GenerationProvider.test.tsx` |
| 실패 작업을 재시도한다 | POST | `/guidebook-generations/{jobId}/retry` | 생성 실패 화면 | retry 가능 오류에서 CSRF 요청 후 상태 조회를 재개한다. | `GuidebookGeneratingPage.test.tsx` |
| 내 가이드북 목록을 본다 | GET | `/guidebooks?size=20&cursor=...` | `/guidebooks` | cursor 기반 다음 목록을 조회한다. | `GuidebookPages.test.tsx` |
| 일정·장소 상세를 본다 | GET | `/guidebooks/{guidebookId}` | `/guidebooks/{id}` | 여행 일정과 장소 snapshot을 화면 데이터로 표시한다. | `GuidebookPages.test.tsx` |
| HTML 가이드북을 본다 | GET | `/guidebooks/{guidebookId}/viewer` | `/guidebooks/{id}/viewer` | 서버 HTML을 sandbox iframe `srcDoc`으로 표시한다. | `GuidebookPages.test.tsx` |
| 가이드북을 목록에서 삭제한다 | DELETE | `/guidebooks/{guidebookId}` | 가이드북 상세·목록 | CSRF 요청 후 목록에서 제거한다. | `GuidebookPages.test.tsx` |
| 쿠폰으로 생성권을 받는다 | POST | `/credits/coupons/redeem` | `/mypage/coupon` | 쿠폰 코드와 서버 오류 코드를 화면 메시지로 변환한다. | `CouponPage.test.tsx` |

## 4. 마이페이지·알림·정책

| 사용자 유즈케이스 | Method | Path | FE 사용 위치 | 현재 처리 | 관련 검증 |
| --- | --- | --- | --- | --- | --- |
| 프로필과 미읽은 알림 수를 본다 | GET | `/members/me` | `/mypage` | 프로필, 이메일과 알림 badge를 표시한다. | `MyPage.test.tsx` |
| 알림 목록을 본다 | GET | `/notifications?page=1&size=20` | `/mypage/notifications`, 전역 완료 감지 | 최신 20개와 미읽음 수를 표시·동기화한다. | `NotificationPage.test.tsx`, `NotificationCenter.test.tsx` |
| 열린 웹앱에서 새 알림을 받는다 | GET (SSE) | `/notifications/stream` | 전역 `NotificationCenter` | 앱에서 하나의 EventSource만 유지한다. `connected`와 재연결은 목록·배지만 복구하고, 새 `notification` 이벤트에만 토스트를 표시한다. | `NotificationCenter.test.tsx`, `notifications.test.ts` |
| 백그라운드·종료 상태에서 가이드북 완료 알림을 받는다 | Web Push | BE 내부 전송 | Service Worker | 최소 payload를 검증해 시스템 알림을 표시하고 클릭 시 기존 창 또는 새 창으로 가이드북 목록의 대상 카드를 연다. | `serviceWorkerScript.test.ts` |
| 알림 하나를 삭제한다 | DELETE | `/notifications/{notificationId}` | 알림 swipe 동작 | 요청 중 중복 조작을 막고 성공 시 목록에서 제거한다. | `NotificationPage.test.tsx` |
| 알림을 모두 삭제한다 | DELETE | `/notifications` | 알림 화면 | 요청 중 버튼을 비활성화하고 성공 시 빈 상태로 전환한다. | `NotificationPage.test.tsx` |
| 약관·개인정보 처리방침을 본다 | GET | `/policies/{terms|privacy}` | 로그인 화면 정책 modal | Markdown 전문을 modal에 표시한다. | `App.test.tsx` |

### 실시간 알림 복구 원칙

- SSE는 새 알림을 즉시 알려 주는 보조 채널이며 알림의 원본은 서버 목록 API다.
- EventSource의 자동 재연결 뒤 과거 알림 토스트를 재생하지 않고 목록을 조회해 배지를 복구한다.
- 가이드북 완료 토스트를 선택하면 읽음 처리 후 가이드북 목록으로 이동하고 대상 카드를 강조한다.
- SSE와 Web Push는 `notification_id`를 공통 중복 기준으로 사용한다. SSE 성공 시 BE가 Push를 생략하고, FE도 채널 경합 시 같은 ID를 한 번만 표시한다.
- `push_enabled=false`, 로그아웃, 탈퇴와 세션 종료에서는 연결을 닫는다.

## 현재 연동하지 않는 V1 서버 기능

- 정책 목록 API는 현재 FE가 직접 호출하지 않는다.
- 평가·랭킹 API는 V1 현재 화면에 연결하지 않았다.
- Web Push 구독·표시·클릭 흐름은 연결했으며 실제 브라우저 수신 E2E는 배포 VAPID 설정과 함께 확인한다.
- DB 테이블과 migration은 FE 구현 문서 범위가 아니며 BE 저장소 문서를 따른다.
