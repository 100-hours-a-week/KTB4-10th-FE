import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('기초 설정 화면을 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '프론트엔드 기초 설정 완료' }),
    ).toBeInTheDocument()
  })

  it('알 수 없는 경로를 기초 설정 화면으로 보낸다', async () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: '프론트엔드 기초 설정 완료' }),
    ).toBeInTheDocument()
  })
})
