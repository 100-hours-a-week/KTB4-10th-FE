import { Navigate, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useGeneration } from '../model/generation.ts'

export function GuidebookAccess({ children }: { children: ReactNode }) {
  const { checking, member, sessionError, checkSession } = useGeneration()
  if (checking) return <main className="app-shell"><State>로그인 정보를 확인하고 있어요.</State></main>
  if (member?.status === 'ONBOARDING') return <Navigate to="/preferences" replace />
  if (!member && sessionError) return <Navigate to="/" replace />
  if (!member) return <main className="app-shell"><State error onRetry={checkSession}>로그인이 필요해요.<Link to="/">로그인으로</Link></State></main>
  return children
}

export function BookHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="book-header">
    <Link className="book-back" to="/guidebooks" aria-label="가이드북 목록">‹</Link>
    <h1>{title}</h1>{children}
  </header>
}

export function State({ children, error, onRetry }: { children: ReactNode; error?: boolean; onRetry?: () => void }) {
  return <div className={`book-state${error ? ' book-state--error' : ''}`} role={error ? 'alert' : 'status'}>
    <div>{children}</div>
    {onRetry && <button className="secondary-button" onClick={onRetry}>다시 확인</button>}
  </div>
}

export function BookCover() {
  return <span className="book-cover" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M7 5h16a2 2 0 0 1 2 2v21H9a3 3 0 0 1-3-3V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" /><path d="M10 5v19M6 24h19M17 10v9m-4-4.5h8" stroke="currentColor" strokeWidth="1.5" /></svg></span>
}
