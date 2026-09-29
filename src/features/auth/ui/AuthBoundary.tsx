import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { getMemberPreferences } from '../../preference/api/preferences.ts'
import { getCurrentMember, type CurrentMember } from '../api/auth.ts'
import { AuthLoadingView } from './AuthLoadingView.tsx'
import { LoginPage } from './LoginPage.tsx'

export function HomeEntry() {
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [hasPreferences, setHasPreferences] = useState<boolean | null>(null)
  const [anonymous, setAnonymous] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getCurrentMember(), getMemberPreferences()])
      .then(([nextMember, preferences]) => {
        if (!active) return
        setMember(nextMember)
        setHasPreferences(preferences.length > 0)
      })
      .catch(() => { if (active) setAnonymous(true) })
    return () => { active = false }
  }, [])

  if (anonymous) return <LoginPage />
  if (!member || hasPreferences === null) return <AuthLoadingView />
  return <Navigate
    to={member.status === 'ONBOARDING' || !hasPreferences ? routes.preferences : routes.map}
    replace
  />
}

export function AuthBoundary({ children, allowOnboarding = false }: {
  children: ReactNode
  allowOnboarding?: boolean
}) {
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    getCurrentMember()
      .then((next) => { if (active) setMember(next) })
      .catch(() => { if (active) setMember(null) })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])

  if (checking) return <AuthLoadingView />
  if (!member) return <Navigate to={routes.home} replace />
  if (!allowOnboarding && member.status === 'ONBOARDING') {
    return <Navigate to={routes.preferences} replace />
  }
  return children
}
