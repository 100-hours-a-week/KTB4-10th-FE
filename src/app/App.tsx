import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthCompletePage } from '../features/auth/ui/AuthCompletePage.tsx'
import { LoginPage } from '../features/auth/ui/LoginPage.tsx'
import { PreferenceSelectionPage } from '../features/preference/ui/PreferenceSelectionPage.tsx'
import { RoutePlaceholderPage } from '../pages/RoutePlaceholderPage.tsx'
import { routes } from '../shared/config/routes.ts'

function App() {
  return (
    <Routes>
      <Route path={routes.home} element={<LoginPage />} />
      <Route path={routes.authComplete} element={<AuthCompletePage />} />
      <Route path={routes.authError} element={<LoginPage />} />
      <Route
        path={routes.preferences}
        element={<PreferenceSelectionPage />}
      />
      <Route path={routes.map} element={<RoutePlaceholderPage title="지도" />} />
      <Route
        path={routes.guidebookDetail}
        element={<RoutePlaceholderPage title="가이드북 상세" />}
      />
      <Route path="*" element={<Navigate to={routes.home} replace />} />
    </Routes>
  )
}

export default App
