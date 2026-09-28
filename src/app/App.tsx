import { Navigate, Route, Routes } from 'react-router-dom'
import { RoutePlaceholderPage } from '../pages/RoutePlaceholderPage.tsx'
import { SetupPage } from '../pages/SetupPage.tsx'
import { routes } from '../shared/config/routes.ts'

function App() {
  return (
    <Routes>
      <Route path={routes.home} element={<SetupPage />} />
      <Route
        path={routes.authComplete}
        element={<RoutePlaceholderPage title="로그인 완료" />}
      />
      <Route
        path={routes.preferences}
        element={<RoutePlaceholderPage title="취향 선택" />}
      />
      <Route
        path={routes.guidebookDetail}
        element={<RoutePlaceholderPage title="가이드북 상세" />}
      />
      <Route path="*" element={<Navigate to={routes.home} replace />} />
    </Routes>
  )
}

export default App
