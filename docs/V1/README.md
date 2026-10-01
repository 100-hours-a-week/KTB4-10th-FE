# KGB Frontend V1 현재 구현 문서

이 디렉터리는 KGB Frontend V1의 **현재 코드에서 확인되는 화면, 사용자 흐름과 API 연동**만 기록한다. 미래 버전 계획과 아직 적용하지 않은 최적화는 현재 구현과 구분해 표시한다.

## 기준

- 기준 브랜치: `origin/dev`
- 기준 commit: `3f6a6fd`
- 기준일: 2026-10-01
- 화면·라우트 기준: `src/app/App.tsx`, `src/shared/config/routes.ts`, `src/features/**/ui`
- API 기준: `src/features/**/api`, `src/shared/api`
- 품질 기준: `package.json`, Vite·Vitest 설정, `.github/workflows/frontend-ci.yml`

## 문서

- [API 연동 현황과 화면 유즈케이스](./API-%EC%97%B0%EB%8F%99-%ED%98%84%ED%99%A9.md)
- [V1 유저 플로우](./%EC%9C%A0%EC%A0%80-%ED%94%8C%EB%A1%9C%EC%9A%B0.md)
- [프론트엔드 개발 표준 및 구조](./%ED%94%84%EB%A1%A0%ED%8A%B8%EC%97%94%EB%93%9C-%EA%B0%9C%EB%B0%9C-%ED%91%9C%EC%A4%80.md)
- [성능 최적화 방안](./%EC%84%B1%EB%8A%A5-%EC%B5%9C%EC%A0%81%ED%99%94-%EB%B0%A9%EC%95%88.md)

## 문서 역할

- DB 스키마와 서버 API 전체 계약의 source of truth는 BE 저장소다. FE 문서에 테이블 정의서를 복제하지 않는다.
- `API 연동 현황`은 서버가 제공하는 모든 API가 아니라 **FE가 현재 실제로 호출하는 API**를 기록한다.
- 기존 `docs/*.md`는 설계 과정과 초안을 보존한다. 이 디렉터리는 Issue 범위 판단과 구현 확인에 사용하는 V1 스냅샷이다.
- 라우트, API 호출, 주요 상태 전이 또는 성능 전략이 `dev`에 병합되면 관련 V1 문서를 같은 PR에서 갱신한다.
- 문서와 코드가 다르면 현재 동작은 라우트·API 모듈·테스트를 우선해 확인하고 문서를 수정한다.
