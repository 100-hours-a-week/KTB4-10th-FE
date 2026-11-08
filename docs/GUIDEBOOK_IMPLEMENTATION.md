# 가이드북 V1 구현

## 화면과 API

최초 생성 조건 화면은 선택 `user_request` 입력란과 200자 카운터를 제공한다(BE #337, FE #190). 미입력은 요청에서 생략하고 입력값은 trim 후 공백 불가·최대 200자로 검증하여 전달한다. 입력값은 취향 수정 왕복 시 초안에 보존한다. 접수 응답 유실 시 입력을 잠그고 정규화된 동일 요청·멱등 키로 재접수한다. Figma 디자인 파일은 별도 동기화 대상이며 실제 화면은 구현되어 있다.

| 화면 | 경로 | API |
|---|---|---|
| 목록·삭제 | /guidebooks | GET /guidebooks, DELETE /guidebooks/{id} |
| 조건 입력 | /guidebooks/new | POST /guidebook-generations |
| 생성 진행·실패 | /guidebooks/generating/{jobId} | GET /guidebook-generations/{jobId}, POST /guidebook-generations/{jobId}/retry |
| 완료 요약 | /guidebooks/{id} | GET /guidebooks/{id} |
| HTML 뷰어 | /guidebooks/{id}/viewer | GET /guidebooks/{id}/viewer |
| 알림함 | 앱 상단 알림 버튼 | GET /notifications, DELETE /notifications/{id} |

API 경로에는 /api/v1 접두사가 붙는다. 뷰어 계약은 백엔드
feat/116-guidebook-html-viewer 브랜치의 GuidebookViewerResponse를 따른다.
백엔드 dev 체크아웃에는 아직 뷰어가 없으므로 통합 환경에는 해당 구현이 필요하다.

## 생성과 SSE

- App의 GenerationProvider가 작업별 SSE 연결을 소유한다. 지도·목록·마이페이지·로그인된 회원의 취향 화면으로 이동해도 연결을 유지한다.
- 202 수신 시 job_id를 등록하고 생성 SSE를 구독한다. AI 콜백의 progress.step/message를 BE가 SSE로 전달하며 FE는 수신한 단계에 맞춰 진행바와 안내를 갱신한다.
- 진행바는 접수 대기 → 장소 확인 → 일정 구성 → 내용 작성 → 최종 정리의 단계 기준이다. 재생성은 장소 확인을 제외한다. 작업량 퍼센트나 남은 시간으로 표현하지 않고 타이머로 증가시키지 않는다. 처리 중 단계 정보가 없으면 확인 중으로 표시한다.
- COMPLETED/FAILED/CANCELED에서 연결을 닫는다. FAILED는 상태 GET으로 오류와 기존 입력을 조회한다. 연결 오류는 작업 실패로 취급하지 않고 마지막 수신 단계를 유지한다. 낮은 sequence·이전 attempt 이벤트는 진행바를 되돌리지 않는다.
- 실패 작업은 사용자가 재시도를 눌렀을 때만 POST /{jobId}/retry를 호출한다. attempt_count 3 이상이면 재시도 불가. CANCELED는 재시도하지 않는다.
- 생성 접수의 응답 유실은 같은 입력과 Idempotency-Key로 다시 요청한다. 실패 작업 retry API와는 별개다.
- job_id만 회원별 localStorage 키에 보관한다. 새로고침 후 현재 회원 확인을 거쳐 해당 회원의 작업만 조회한다.
- 앱 언마운트·로그인 화면 이동 시 SSE와 진행 중 GET을 정리한다. 브라우저 종료 후에도 BE 콜백이 결과를 반영한다. 다시 열면 저장된 작업 ID로 SSE를 재구독한다.
- 상태 GET은 DB 조회 전용이며 AI를 호출하지 않는다. BE의 최신 진행 캐시가 없으면 다음 콜백 전까지 단계 확인 중으로 표시할 수 있다.
- 여러 탭은 각각 SSE를 연결한다. 현재 작업 조회 API가 없으므로 저장소 삭제·다른 기기에서 작업 ID 복구는 지원하지 않는다.

## 결과와 알림

- 목록의 FAILED 배너 옆 취소하기는 프론트 작업 추적을 해제한다. 배너와 회원별 localStorage의 추적 정보만 지우며 BE의 FAILED 이력은 유지한다. 서버 취소·상태 변경 API는 호출하지 않는다. PENDING/PROCESSING에는 이 버튼을 제공하지 않는다.

- 진행 화면에서 완료되면 완료 요약으로 이동한다. 다른 화면에서는 강제로 이동하지 않는다.
- 백엔드가 저장한 완료 알림을 다시 조회해 알림 개수와 토스트를 갱신한다. 별도의 결과 확인 배너나 브라우저 푸시는 추가하지 않는다.
- 알림함에서 완료 요약으로 이동한다. 서버에는 읽음 API가 없으므로 알림 열기만으로 삭제하지 않으며 사용자가 삭제하면 미확인 개수가 줄어든다.
- 서버 알림 생성 실패는 결과 저장과 별개다. 알림 조회에 완료 알림이 없더라도 완성된 가이드북은 목록에서 확인할 수 있다.
- 목록 카드에서는 HTML 뷰어로 바로 이동한다.

## PNG와 API 차이

- 표지·과거 취향 태그·세부 작업량 퍼센트는 조회 응답에 없으므로 임의로 표시하지 않는다. 생성 화면은 콜백 단계 진행바와 실제 작업 상태를 표시한다.
- 지역은 백엔드 AdministrativeProvince/AdministrativeDistrict의 서비스 지역을 사용한다. 지역 Enum이 바뀌면 model/regions.ts도 동기화해야 한다.
- 서울 기준 오늘부터 1년 이내, 양끝 포함 최대 7일과 동행별 인원 제한을 적용한다.
- HTML은 sanitize하거나 태그를 제거하지 않고 content_html 전체를 iframe srcDoc으로 전달한다. sandbox는 HTML/CSS를 유지하면서 스크립트·부모 페이지 접근·팝업 등을 제한한다.
- PDF는 버튼과 준비 중 안내만 제공한다. 재생성과 공유는 제외한다.

## 검증

실패 화면은 입력 오류·피드백 적용 불가·후보 부족을 서버 오류와 구분한다. 알려진 입력 오류는 기술 재시도를 숨기고 조건 수정·피드백 수정 동선을 제공한다. 상태 GET의 initial_request로 여행 조건과 user_request를 복원하며 최초 피드백 수정은 입력란에 초점을 맞춘다. 재생성 submitted_feedback은 기존 피드백 입력란에 복원하고 가능 횟수·시간을 다시 조회한다. 조건 수정은 별도 최초 생성임을 안내한다. 스냅샷이 없으면 빈 수정 화면으로 보내지 않고 입력 다시 불러오기를 제공한다.

- 전역 폴링 유지·중첩 방지·종료 상태·수동 재시도·회원별 복구·조회 오류 복구 테스트.
- 생성 요청 멱등성, 동행/지역 입력, 목록 더 보기·삭제, 원본 HTML 전달, 완료 알림 갱신 테스트.
- 모의 API를 연결한 Chrome에서 생성 → 다른 화면 이동 → 완료 알림 → 요약 → 뷰어 → PDF 안내 → 삭제 흐름과 320/390/1440px 셸 확인.
- 실제 AI 및 로그인 세션을 사용한 통합 검증은 별도 환경에서 필요하다.

## 재생성 정책 연동 (2026-10-23)

- BE #281·PR #282의 상세 응답 `regeneration.remaining_count`, `expires_at`, `available`을 완료 화면과 재생성 입력 화면에서 사용한다.
- 완료 화면은 재생성 버튼에 남은 횟수를 함께 표시한다. 횟수 소진 또는 최초 생성 완료 후 10분 만료 시 버튼을 비활성화하고 사유를 안내한다.
- 재생성 입력 URL에 직접 접근해도 상세 API로 가능 여부를 다시 확인하기 전에는 입력·제출을 허용하지 않는다. 소진·만료 상태이면 입력창과 제출 버튼을 모두 잠근다.
- 열린 화면에서도 `expires_at` 도달 시 즉시 재생성 UI를 잠그며, 요청 시점의 최종 판정은 BE가 담당한다.
- `REGENERATION_LIMIT_EXCEEDED`, `REGENERATION_WINDOW_EXPIRED` 응답은 각각 횟수 소진과 시간 만료 안내로 매핑한다.
