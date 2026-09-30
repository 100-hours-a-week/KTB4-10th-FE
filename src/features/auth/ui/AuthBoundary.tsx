import axios from 'axios'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { getMemberPreferences } from '../../preference/api/preferences.ts'
import {
  getCachedCurrentMember,
  getCurrentMember,
  type CurrentMember,
} from '../api/auth.ts'
import { AuthCheckErrorView, SessionCheckLoadingView } from './AuthLoadingView.tsx'
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
  if (!member || hasPreferences === null) return <SessionCheckLoadingView />
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
    failure: 'UNAUTHORIZED' | 'TEMPORARY' | null
  } | null>(() => {
    const member = getCachedCurrentMember()
    return member ? { pathname, member, failure: null } : null
  })
  const [retryRevision, setRetryRevision] = useState(0)

  useEffect(() => {
    let active = true
    getCurrentMember()
      .then((member) => {
        if (active) setAuthState({ pathname, member, failure: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        const failure = axios.isAxiosError(error) && error.response?.status === 401
          ? 'UNAUTHORIZED'
          : 'TEMPORARY'
        setAuthState({ pathname, member: null, failure })
      })
    return () => { active = false }
  }, [pathname, retryRevision])

  if (!authState) return <SessionCheckLoadingView />
  if (authState.pathname !== pathname) {
    return authState.member?.status === 'ACTIVE' ? children : <SessionCheckLoadingView />
  }
  const { failure, member } = authState
  if (failure === 'UNAUTHORIZED') {
    return <Navigate
      to={routes.home}
      replace
      state={{ authNotice: 'SESSION_EXPIRED' }}
    />
  }
  if (failure === 'TEMPORARY') {
    return <AuthCheckErrorView onRetry={() => {
      setAuthState(null)
      setRetryRevision((current) => current + 1)
    }} />
  }
  if (!member) return <Navigate to={routes.home} replace />
  if (!allowOnboarding && member.status === 'ONBOARDING') {
    return <Navigate to={routes.preferences} replace />
  }
  return children
}
