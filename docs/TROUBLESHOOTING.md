# 트러블 슈팅

## Vitest 설정을 Vite 타입이 인식하지 못함

### 현상

`npm run typecheck`에서 `vite.config.ts`의 `test` 속성을 알 수 없다는 오류가 발생했다.

### 원인

`defineConfig`를 `vite`에서 가져오면 Vite 설정 타입만 적용되어 Vitest의 `test` 속성이 포함되지 않는다.

### 해결

`defineConfig`를 `vitest/config`에서 가져와 Vite 플러그인과 Vitest 설정을 함께 타입 검사하도록 했다.

### 회고

설정 파일도 TypeScript 검사 대상이다. 실행 시점까지 기다리지 않고 별도 `typecheck` 단계에서 도구 간 설정 타입 차이를 확인할 수 있었다.

## 컴포넌트 테스트 사이에 DOM이 남음

### 현상

각 테스트를 따로 보면 성공하지만 같은 파일의 두 번째 테스트에서 동일한 제목이 두 개 발견됐다.

### 원인

Vitest 공통 설정에 Testing Library의 DOM `cleanup` 생명주기를 등록하지 않아 이전 테스트의 렌더링 결과가 남았다.

### 해결

`src/test/setup.ts`에서 `afterEach(cleanup)`을 등록해 테스트가 끝날 때마다 DOM을 비운다.

### 회고

테스트는 실행 순서에 의존하면 안 된다. 공통 정리를 명시해 각 테스트가 독립된 브라우저 상태에서 시작하도록 해야 한다.
