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
