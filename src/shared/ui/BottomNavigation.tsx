import { NavLink } from 'react-router-dom'
import { routes } from '../config/routes.ts'

const tabs = [
  { to: routes.map, label: '지도', icon: '⌖' },
  { to: routes.guidebooks, label: '가이드북', icon: '▤' },
  { to: routes.myPage, label: '마이페이지', icon: '○' },
] as const

export function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          className={({ isActive }) => (
            `bottom-navigation__item${isActive ? ' bottom-navigation__item--active' : ''}`
          )}
          key={to}
          to={to}
        >
          <span className="bottom-navigation__icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
