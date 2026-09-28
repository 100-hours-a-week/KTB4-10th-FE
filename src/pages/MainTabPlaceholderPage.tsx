import { BottomNavigation } from '../shared/ui/BottomNavigation.tsx'

type MainTabPlaceholderPageProps = {
  title: string
}

export function MainTabPlaceholderPage({ title }: MainTabPlaceholderPageProps) {
  return (
    <main className="app-shell main-tab-placeholder">
      <section>
        <p className="eyebrow">V1 준비 중</p>
        <h1>{title}</h1>
        <p>해당 화면은 다음 화면 단위 이슈에서 구현합니다.</p>
      </section>
      <BottomNavigation />
    </main>
  )
}
