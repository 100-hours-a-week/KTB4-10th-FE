import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { getCurrentMember } from '../api/auth.ts'
import { AuthLoadingView } from './AuthLoadingView.tsx'

export function AuthCompletePage() {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    getCurrentMember()
      .then((member) => {
        if (active) navigate(member.status === 'ONBOARDING' ? routes.preferences : routes.map, { replace: true })
      })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [navigate])

  if (failed) {
    return (
      <main className="app-shell auth-result-page">
        <div className="auth-result-page__content">
          <div className="brand-mark">KGB</div>
          <h1>로그인 정보를 확인하지 못했어요</h1>
          <p>다시 로그인해 주세요.</p>
          <button className="primary-button" type="button" onClick={() => navigate(routes.home, { replace: true })}>로그인 화면으로</button>
        </div>
      </main>
    )
  }

  return <AuthLoadingView />
}
