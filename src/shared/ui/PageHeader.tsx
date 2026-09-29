import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  leading?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, leading, children }: PageHeaderProps) {
  return (
    <header className="app-page-header">
      <div className="app-page-header__leading">{leading}</div>
      <h1>{title}</h1>
      <div className="app-page-header__actions">{children}</div>
    </header>
  )
}

export function NotificationBellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 20h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
