import { Link } from 'react-router-dom'
import { routes } from '../shared/config/routes.ts'

type RoutePlaceholderPageProps = {
  title: string
}

export function RoutePlaceholderPage({ title }: RoutePlaceholderPageProps) {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <p className="eyebrow">V1 임시 경로</p>
        <h1>{title}</h1>
        <p className="description">화면 단위 Issue에서 Figma V1 디자인으로 구현합니다.</p>
        <Link to={routes.home}>기초 설정 화면으로 돌아가기</Link>
      </section>
    </main>
  )
}
