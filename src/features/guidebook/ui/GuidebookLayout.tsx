import { Navigate, Link } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { useGeneration } from '../model/generation.ts'
import { routes } from '../../../shared/config/routes.ts'
import { AuthCheckErrorView, SessionCheckLoadingView } from '../../auth/ui/AuthLoadingView.tsx'

export function GuidebookAccess({ children }: { children: ReactNode }) {
  const { checking, member, sessionFailure, checkSession } = useGeneration()
  if (checking) return <SessionCheckLoadingView />
  if (sessionFailure === 'UNAUTHORIZED') {
    return <Navigate
      to={routes.home}
      replace
      state={{ authNotice: 'SESSION_EXPIRED' }}
    />
  }
  if (sessionFailure === 'TEMPORARY') {
    return <AuthCheckErrorView onRetry={checkSession} />
  }
  if (member?.status === 'ONBOARDING') return <Navigate to={routes.preferences} replace />
  if (!member) return <SessionCheckLoadingView />
  return children
}

export function BookHeader({ title, children, backTo = '/guidebooks' }: { title: string; children?: ReactNode; backTo?: string }) {
  return (
    <PageHeader
      title={title}
      leading={<Link className="book-back" to={backTo} aria-label="이전 화면">‹</Link>}
    >
      {children}
    </PageHeader>
  )
}

export function State({ children, error, onRetry }: { children: ReactNode; error?: boolean; onRetry?: () => void }) {
  return <div className={`book-state${error ? ' book-state--error' : ''}`} role={error ? 'alert' : 'status'}>
    <div>{children}</div>
    {onRetry && <button className="secondary-button" onClick={onRetry}>다시 확인</button>}
  </div>
}

export function BookCover({ thumbnailUrl }: { thumbnailUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return <span className="book-cover" aria-hidden="true">
    {thumbnailUrl && failedUrl !== thumbnailUrl
      ? <img src={thumbnailUrl} alt="" onError={() => setFailedUrl(thumbnailUrl)} />
      : <svg viewBox="0 0 32 32" fill="none"><path d="M7 5h16a2 2 0 0 1 2 2v21H9a3 3 0 0 1-3-3V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" /><path d="M10 5v19M6 24h19M17 10v9m-4-4.5h8" stroke="currentColor" strokeWidth="1.5" /></svg>}
  </span>
}
