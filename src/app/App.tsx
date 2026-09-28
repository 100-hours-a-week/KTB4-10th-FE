import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthCompletePage } from '../features/auth/ui/AuthCompletePage.tsx'
import { LoginPage } from '../features/auth/ui/LoginPage.tsx'
import { MapPage } from '../features/map/ui/MapPage.tsx'
import { MyPage } from '../features/member/ui/MyPage.tsx'
import { PreferenceSelectionPage } from '../features/preference/ui/PreferenceSelectionPage.tsx'
import { MainTabPlaceholderPage } from '../pages/MainTabPlaceholderPage.tsx'
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
      <Route path={routes.map} element={<MapPage />} />
      <Route
        path={routes.guidebooks}
        element={<MainTabPlaceholderPage title="가이드북" />}
      />
      <Route path={routes.myPage} element={<MyPage />} />
      <Route
        path={routes.notifications}
        element={<RoutePlaceholderPage title="알림" />}
      />
      <Route
        path={routes.settings}
        element={<RoutePlaceholderPage title="설정" />}
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
