import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
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
    void getCurrentMember()
      .then(async (nextMember) => {
        const preferences = await getMemberPreferences()
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
  const { pathname } = useLocation()
  const [authState, setAuthState] = useState<{
    pathname: string
    member: CurrentMember | null
  } | null>(null)

  useEffect(() => {
    let active = true
    getCurrentMember()
      .then((member) => {
        if (active) setAuthState({ pathname, member })
      })
      .catch(() => {
        if (active) setAuthState({ pathname, member: null })
      })
    return () => { active = false }
  }, [pathname])

  if (!authState || authState.pathname !== pathname) return <AuthLoadingView />
  const { member } = authState
  if (!member) return <Navigate to={routes.home} replace />
  if (!allowOnboarding && member.status === 'ONBOARDING') {
    return <Navigate to={routes.preferences} replace />
  }
  return children
}
