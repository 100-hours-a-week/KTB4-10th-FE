import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthBoundary } from './AuthBoundary.tsx'

const { getCachedCurrentMemberMock, getCurrentMemberMock } = vi.hoisted(() => ({
  getCachedCurrentMemberMock: vi.fn(),
  getCurrentMemberMock: vi.fn(),
}))

vi.mock('../api/auth.ts', () => ({
  getCachedCurrentMember: getCachedCurrentMemberMock,
  getCurrentMember: getCurrentMemberMock,
}))

describe('AuthBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCachedCurrentMemberMock.mockReturnValue(null)
  })

  it('검증된 ACTIVE 회원은 다음 보호 화면을 즉시 표시하며 백그라운드에서 재검증한다', async () => {
    const user = userEvent.setup()
    let cachedMember: { status: string } | null = null
    let resolveSecondRequest: ((value: { status: string }) => void) | undefined
    getCachedCurrentMemberMock.mockImplementation(() => cachedMember)
    getCurrentMemberMock
      .mockImplementationOnce(() => {
        cachedMember = { status: 'ACTIVE' }
        return Promise.resolve(cachedMember)
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondRequest = resolve
      }))

    render(
      <MemoryRouter initialEntries={['/first']}>
        <Routes>
          <Route path="/first" element={(
            <AuthBoundary>
              <h1>첫 화면</h1>
              <Link to="/second">다음 화면</Link>
            </AuthBoundary>
          )} />
          <Route path="/second" element={(
            <AuthBoundary>
              <h1>두 번째 화면</h1>
            </AuthBoundary>
          )} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('link', { name: '다음 화면' }))

    expect(screen.getByRole('heading', { name: '두 번째 화면' })).toBeInTheDocument()
    expect(screen.queryByText('로그인 정보를 확인하고 있어요'))
      .not.toBeInTheDocument()
    expect(getCurrentMemberMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveSecondRequest?.({ status: 'ACTIVE' })
    })
  })
})
