import { Link } from 'react-router-dom'
import { routes } from '../shared/config/routes.ts'

const setupItems = [
  'React + TypeScript + Vite 실행 환경',
  '세션 쿠키와 CSRF를 포함하는 Axios 기본 설정',
  'V1 핵심 화면의 임시 라우팅',
  'Vitest + Testing Library 테스트 환경',
]

export function SetupPage() {
  return (
    <main className="setup-page">
      <section className="setup-card" aria-labelledby="setup-title">
        <p className="eyebrow">KGB V1 Frontend</p>
        <h1 id="setup-title">프론트엔드 기초 설정 완료</h1>
        <p className="description">
          이 화면은 개발 환경 확인용입니다. 실제 UI는 Figma V1 화면 단위로 교체합니다.
        </p>

        <ul className="setup-list">
          {setupItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <nav aria-label="임시 V1 경로">
          <Link to={routes.authComplete}>로그인 완료 경로 확인</Link>
          <Link to={routes.preferences}>취향 선택 경로 확인</Link>
          <Link to="/guidebooks/example">가이드북 상세 경로 확인</Link>
        </nav>
      </section>
    </main>
  )
}
