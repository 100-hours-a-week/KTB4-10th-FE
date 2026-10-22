import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AboutPage } from './AboutPage.tsx'

describe('AboutPage', () => {
  it('서비스 소개와 실제 화면, 데이터 출처와 문의 정보를 제공한다', () => {
    const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /취향에서 시작해,\s*한 권의 여행으로/ })).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(8)
    expect(screen.getByRole('link', { name: '공공데이터포털' })).toHaveAttribute('href', 'https://www.data.go.kr/')
    expect(screen.getByRole('link', { name: '한국관광공사 TourAPI' })).toHaveAttribute('href', 'https://api.visitkorea.or.kr/')
    expect(screen.getAllByRole('link', { name: 'ktb10@kguidebook.site' })[0]).toHaveAttribute('href', 'mailto:ktb10@kguidebook.site')
    expect(screen.getAllByRole('link', { name: 'KGB 시작하기' })[0]).toHaveAttribute('href', '/')
  })
})
