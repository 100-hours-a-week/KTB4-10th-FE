# 가이드북 V1 구현

## 화면과 API

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

## 생성과 폴링

- App의 GenerationProvider가 폴링을 소유한다. 지도·목록·마이페이지·로그인된 회원의 취향 화면으로 이동해도 계속 조회한다.
- 202 수신 시 job_id를 등록하고 즉시 조회한다. 응답이 PENDING/PROCESSING이면 **응답 완료 2초 후** 다음 GET을 실행한다. 느린 응답과 다음 요청은 겹치지 않는다.
- COMPLETED/FAILED/CANCELED에서 중단한다. 상태 조회 오류도 자동 생성 재시도와 구분해 중단하고, 사용자가 조회를 재개할 수 있다.
- 실패 작업은 사용자가 재시도를 눌렀을 때만 POST /{jobId}/retry를 호출한다. attempt_count 3 이상이면 재시도 불가. CANCELED는 재시도하지 않는다.
- 생성 접수의 응답 유실은 같은 입력과 Idempotency-Key로 다시 요청한다. 실패 작업 retry API와는 별개다.
- job_id만 회원별 localStorage 키에 보관한다. 새로고침 후 현재 회원 확인을 거쳐 해당 회원의 작업만 조회한다.
- 앱 언마운트·로그인 화면 이동 시 타이머와 진행 중 GET을 정리한다. 브라우저를 닫으면 폴링할 수 없으며, 비활성 탭에서는 브라우저가 타이머를 지연할 수 있다.
- 현재 백엔드는 GET 상태 조회 시 AI 결과를 동기화한다. AI 작업은 화면 이탈 후에도 진행되지만, 브라우저 종료 중의 완료 반영을 보장하려면 추후 서버 폴링/복구가 필요하다.
- 여러 탭의 폴링은 별도로 실행된다. 현재 작업 조회 API가 없으므로 저장소 삭제·다른 기기에서 작업 ID 복구는 지원하지 않는다.

## 결과와 알림

- 진행 화면에서 완료되면 완료 요약으로 이동한다. 다른 화면에서는 강제로 이동하지 않는다.
- 백엔드가 저장한 완료 알림을 다시 조회해 알림 개수와 토스트를 갱신한다. 별도의 결과 확인 배너나 브라우저 푸시는 추가하지 않는다.
- 알림함에서 완료 요약으로 이동한다. 서버에는 읽음 API가 없으므로 알림 열기만으로 삭제하지 않으며 사용자가 삭제하면 미확인 개수가 줄어든다.
- 서버 알림 생성 실패는 결과 저장과 별개다. 알림 조회에 완료 알림이 없더라도 완성된 가이드북은 목록에서 확인할 수 있다.
- 목록 카드에서는 HTML 뷰어로 바로 이동한다.

## PNG와 API 차이

- 표지·과거 취향 태그·세부 진행률·생성권 잔액은 현재 조회 응답에 없으므로 임의로 표시하지 않는다. 기본 표지와 실제 작업 상태만 표시한다.
- 지역은 백엔드 AdministrativeProvince/AdministrativeDistrict의 서비스 지역을 사용한다. 지역 Enum이 바뀌면 model/regions.ts도 동기화해야 한다.
- 서울 기준 오늘부터 1년 이내, 양끝 포함 최대 7일과 동행별 인원 제한을 적용한다.
- HTML은 sanitize하거나 태그를 제거하지 않고 content_html 전체를 iframe srcDoc으로 전달한다. sandbox는 HTML/CSS를 유지하면서 스크립트·부모 페이지 접근·팝업 등을 제한한다.
- PDF는 버튼과 준비 중 안내만 제공한다. 재생성과 공유는 제외한다.

## 검증

- 전역 폴링 유지·중첩 방지·종료 상태·수동 재시도·회원별 복구·조회 오류 복구 테스트.
- 생성 요청 멱등성, 동행/지역 입력, 목록 더 보기·삭제, 원본 HTML 전달, 완료 알림 갱신 테스트.
- 모의 API를 연결한 Chrome에서 생성 → 다른 화면 이동 → 완료 알림 → 요약 → 뷰어 → PDF 안내 → 삭제 흐름과 320/390/1440px 셸 확인.
- 실제 AI 및 로그인 세션을 사용한 통합 검증은 별도 환경에서 필요하다.
