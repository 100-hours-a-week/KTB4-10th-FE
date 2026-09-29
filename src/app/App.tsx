import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthCompletePage } from '../features/auth/ui/AuthCompletePage.tsx'
import { LoginPage } from '../features/auth/ui/LoginPage.tsx'
import { AuthBoundary, HomeEntry } from '../features/auth/ui/AuthBoundary.tsx'
import { MapPage } from '../features/map/ui/MapPage.tsx'
import { MyPage } from '../features/member/ui/MyPage.tsx'
import { PreferenceSelectionPage } from '../features/preference/ui/PreferenceSelectionPage.tsx'
import { GenerationProvider } from '../features/guidebook/model/GenerationProvider.tsx'
import { GuidebookAccess } from '../features/guidebook/ui/GuidebookLayout.tsx'
import { GuidebookListPage } from '../features/guidebook/ui/GuidebookListPage.tsx'
import { GuidebookCreatePage } from '../features/guidebook/ui/GuidebookCreatePage.tsx'
import { GuidebookGeneratingPage } from '../features/guidebook/ui/GuidebookGeneratingPage.tsx'
import { GuidebookDetailPage } from '../features/guidebook/ui/GuidebookDetailPage.tsx'
import { GuidebookViewerPage } from '../features/guidebook/ui/GuidebookViewerPage.tsx'
import { NotificationCenter } from '../features/notification/ui/NotificationCenter.tsx'
import { NotificationPage } from '../features/notification/ui/NotificationPage.tsx'
import { SettingsPage } from '../features/settings/ui/SettingsPage.tsx'
import { routes } from '../shared/config/routes.ts'
import '../features/guidebook/ui/guidebook.css'

function App() {
  return (
    <GenerationProvider>
      <Routes>
        <Route path={routes.home} element={<HomeEntry />} />
        <Route path={routes.authComplete} element={<AuthCompletePage />} />
        <Route path={routes.authError} element={<LoginPage />} />
        <Route
          path={routes.preferences}
          element={<AuthBoundary allowOnboarding><PreferenceSelectionPage /></AuthBoundary>}
        />
        <Route path={routes.map} element={<AuthBoundary><MapPage /></AuthBoundary>} />
        <Route
          path={routes.guidebooks}
          element={<GuidebookAccess><GuidebookListPage /></GuidebookAccess>}
        />
        <Route path={routes.guidebookCreate} element={<GuidebookAccess><GuidebookCreatePage /></GuidebookAccess>} />
        <Route path={routes.guidebookGenerating} element={<GuidebookAccess><GuidebookGeneratingPage /></GuidebookAccess>} />
        <Route path={routes.guidebookViewer} element={<GuidebookAccess><GuidebookViewerPage /></GuidebookAccess>} />
        <Route path={routes.myPage} element={<AuthBoundary><MyPage /></AuthBoundary>} />
        <Route
          path={routes.notifications}
          element={<AuthBoundary><NotificationPage /></AuthBoundary>}
        />
        <Route
          path={routes.settings}
          element={<AuthBoundary><SettingsPage /></AuthBoundary>}
        />
        <Route
          path={routes.guidebookDetail}
          element={<GuidebookAccess><GuidebookDetailPage /></GuidebookAccess>}
        />
        <Route path="*" element={<Navigate to={routes.home} replace />} />
      </Routes>
      <NotificationCenter />
    </GenerationProvider>
  )
}

export default App
