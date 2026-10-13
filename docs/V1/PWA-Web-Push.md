# V1 PWA·Web Push 기반

## 1. 현재 구현 범위

V1 FE는 표준 Web Push를 받을 수 있는 최소 PWA 기반을 구성한다.

- Web App Manifest와 192px·512px 아이콘
- 홈 화면 설치 시 `standalone` 표시
- HTTPS 또는 localhost에서 Service Worker 등록
- Push 이벤트를 시스템 알림으로 표시
- 가이드북 생성 완료 알림 클릭 시 목록으로 이동하고 대상 카드 강조
- 사용자 동의 시 브라우저 Push 구독을 생성하고 현재 회원·세션으로 등록
- 로그아웃·탈퇴 시 현재 브라우저 구독 해제

이 단계에서 Service Worker는 `fetch` 이벤트를 사용하거나 정적 파일을 캐시하지 않는다. 따라서 기존 S3·CloudFront 배포와 브라우저 캐시 전략을 가로채지 않는다.

## 2. Manifest 계약

| 항목 | 값 | 이유 |
| --- | --- | --- |
| `id` | `/` | 동일 origin의 KGB 앱을 안정적으로 식별 |
| `name`, `short_name` | `KGB` | 홈 화면·앱 전환기에 표시 |
| `start_url` | `/` | localhost와 배포 도메인 모두 같은 origin의 로그인 진입점을 사용 |
| `scope` | `/` | 인증·지도·가이드북·마이페이지 전체를 앱 범위로 포함 |
| `display` | `standalone` | iOS·Android 홈 화면에서 브라우저 UI 없이 앱 형태로 표시 |
| 아이콘 | 기존 `favicon.png` 기반 | 임시 KGB 브랜드 자산을 재사용 |

Manifest의 시작 색은 현재 앱 배경인 `#fbfbfc`를 사용한다. 브라우저 테마 색은 HTML의 `prefers-color-scheme` media 조건으로 밝은 환경과 어두운 환경을 구분한다. 시스템 알림 UI의 배경·글자 색은 브라우저와 OS가 결정한다.

## 3. Service Worker 수명주기

- 보안 컨텍스인 HTTPS와 로컬 개발용 localhost에서만 등록한다.
- 초기 화면 렌더링을 방해하지 않도록 `load` 이후 등록한다.
- `updateViaCache: none`으로 Service Worker 스크립트 업데이트 확인이 HTTP 캐시에 묶이지 않게 한다.
- 새 Worker는 즉시 대기 단계를 건너뛰고 현재 client를 제어한다. 현재 Worker가 요청·캐시를 처리하지 않아 이 전환이 안전하다.
- 비지원·사생활 보호 모드·등록 실패 시 PWA 기능만 사용하지 않고 기존 웹 기능은 계속 제공한다.

## 4. Push 페이로드와 클릭 이동

Service Worker는 다음 필드를 사용한다.

```json
{
  "notification_id": "301",
  "type": "GUIDEBOOK_COMPLETED",
  "reference_type": "GUIDEBOOK",
  "reference_id": "101"
}
```

- BE는 식별 필드만 전송하고 Service Worker가 `가이드북 생성 완료` 제목과 최소 안내 문구를 구성한다. 알림 원문이나 구독 키를 Push payload에 복제하지 않는다.
- 네 필드가 모두 유효한 `GUIDEBOOK_COMPLETED`만 표시하며 잘못되거나 이전 형식인 payload는 무시한다.
- `GUIDEBOOK`은 `/guidebooks?highlightGuidebookId={reference_id}`로 이동한다.
- 가이드북 목록은 query를 읽어 대상 카드를 잠시 강조한 뒤 query를 제거한다.
- 열린 동일 origin 창이 있으면 그 창을 이동·포커스하고, 없을 때만 새 창을 연다.
- 이동 경로는 현재 origin 안으로 제한해 외부 URL 주입을 막는다.
- 같은 `notification_id`가 SSE와 Web Push로 경합하면 페이지와 Service Worker가 ID를 공유해 두 채널의 중복 UX를 억제한다. 이미 표시된 시스템 알림도 같은 tag로 다시 만들지 않는다.
- `prefers-reduced-motion: reduce` 환경은 흔들림 없이 테두리와 그림자로 대상 카드를 식별한다.

BE PR #184의 실제 Push payload와 이 계약을 맞춘다. BE는 하나 이상의 SSE 전송이 성공하면 Web Push를 생략하고, SSE 연결이 없거나 전송이 실패할 때 Web Push로 fallback한다.

## 5. 권한과 구독 수명주기

- 페이지 진입만으로 권한을 요청하지 않는다. 지도 최초 안내의 **알림 허용** 또는 설정의 **알림 받기**를 사용자가 직접 선택한 시점에만 요청한다.
- FE는 `GET /push/vapid-public-key`로 공개키만 조회한다. VAPID 개인키는 BE 배포 Secret에만 두며 FE 환경변수·번들·저장소에 넣지 않는다.
- 기존 `PushSubscription`이 있으면 재사용하고, 없을 때만 `pushManager.subscribe()`를 호출한다.
- 구독 정보는 `PUT /members/me/push-subscriptions`로 현재 회원·세션에 등록한다. 서버가 반환한 구독 ID만 로그아웃 정리를 위해 브라우저 저장소에 보관하고 endpoint·암호화 키는 별도로 복제하지 않는다.
- `push_enabled=false`는 SSE와 Web Push 발송을 중단하지만 DB 알림 저장과 브라우저 권한은 유지한다.
- 로그아웃·탈퇴 전에 현재 브라우저의 서버 구독을 해제하고 `PushSubscription.unsubscribe()`를 호출한다. 서버 로그아웃도 현재 세션 구독을 폐기해 FE 정리 실패를 보완한다.
- 재로그인 시 `push_enabled=true`이고 브라우저 권한이 이미 `granted`이면 권한 창 없이 현재 회원으로 다시 등록한다. `default` 또는 `denied`이면 자동 요청하지 않는다.

## 6. iOS·iPadOS 사용 조건

iOS·iPadOS 16.4 이상에서 Web Push를 받으려면 사용자가 KGB를 홈 화면에 추가한 뒤 홈 화면 아이콘으로 실행해야 한다. 브라우저 탭에서만 접속한 상태와 동작이 다르다.

1. Safari 또는 홈 화면 추가를 지원하는 브라우저에서 KGB에 접속한다.
2. 공유 메뉴의 **홈 화면에 추가**를 선택한다.
3. 홈 화면의 KGB 아이콘으로 앱을 실행한다.
4. KGB 설정에서 사용자가 **알림 받기**를 누른 시점에 권한을 요청한다.

권한이 거절된 경우 매번 재요청하지 않고 iOS `설정 → 알림 → KGB`에서 변경하도록 안내한다. Apple의 UserNotifications 문서가 Apple 개발자 사이트에 있어도 이 웹 앱 구성은 Swift를 사용하지 않고 Manifest·Push API·Notifications API·Service Worker 표준으로 구현한다.

## 7. 배포 확인

- `/manifest.webmanifest` 응답의 Content-Type과 200 상태
- `/service-worker.js` 응답의 JavaScript Content-Type, 200 상태와 `/` scope
- 192px·512px 아이콘과 Apple touch icon 응답
- Chrome Application 패널의 Manifest·Service Workers 상태
- iOS 홈 화면 아이콘 실행 시 standalone 표시
- 일반 브라우저와 Service Worker 비지원 환경에서 기존 기능 회귀 확인
- Chrome·Edge의 권한 허용 → 구독 등록 → 로그아웃 구독 해제
- macOS Safari와 iOS 16.4+ 홈 화면 앱의 구독·수신 확인
- 포그라운드 SSE, 백그라운드·종료 상태 Web Push와 동일 알림 ID 중복 억제 확인
- 알림 클릭 시 기존 창 재사용, 대상 카드 자동 스크롤·강조 확인
- 실제 Push 수신은 BE PR #184와 VAPID 배포 설정을 포함해 확인
