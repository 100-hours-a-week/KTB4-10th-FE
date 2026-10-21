import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidebookAccess } from './GuidebookLayout.tsx'

const { checkSessionMock, useGenerationMock } = vi.hoisted(() => ({
  checkSessionMock: vi.fn(),
  useGenerationMock: vi.fn(),
}))

vi.mock('../model/generation.ts', () => ({
  useGeneration: useGenerationMock,
}))

function LoginDestination() {
  const location = useLocation()
  return <output aria-label="로그인 이동 상태">{JSON.stringify(location.state)}</output>
}

function renderAccess() {
  return render(
    <MemoryRouter initialEntries={['/guidebooks']}>
      <Routes>
        <Route path="/guidebooks" element={(
          <GuidebookAccess><h1>가이드북 목록</h1></GuidebookAccess>
        )} />
        <Route path="/preferences" element={<h1>취향 선택</h1>} />
        <Route path="/" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GuidebookAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGenerationMock.mockReturnValue({
      checking: false,
      member: { member_id: 1, status: 'ACTIVE' },
      sessionFailure: null,
      checkSession: checkSessionMock,
    })
  })

  it('유효한 ACTIVE 회원에게 가이드북 화면을 표시한다', () => {
    renderAccess()

    expect(screen.getByRole('heading', { name: '가이드북 목록' })).toBeInTheDocument()
  })

  it('ONBOARDING 회원은 취향 선택 화면으로 이동한다', async () => {
    useGenerationMock.mockReturnValue({
      checking: false,
      member: { member_id: 1, status: 'ONBOARDING' },
      sessionFailure: null,
      checkSession: checkSessionMock,
    })

    renderAccess()

    expect(await screen.findByRole('heading', { name: '취향 선택' })).toBeInTheDocument()
  })

  it('401이면 세션 만료 안내 상태를 담아 로그인 화면으로 이동한다', async () => {
    useGenerationMock.mockReturnValue({
      checking: false,
      member: null,
      sessionFailure: 'UNAUTHORIZED',
      checkSession: checkSessionMock,
    })

    renderAccess()

    expect(await screen.findByRole('status', { name: '로그인 이동 상태' }))
      .toHaveTextContent('{"authNotice":"SESSION_EXPIRED"}')
  })

  it('일시 오류는 현재 화면에서 재확인할 수 있다', async () => {
    const user = userEvent.setup()
    useGenerationMock.mockReturnValue({
      checking: false,
      member: null,
      sessionFailure: 'TEMPORARY',
      checkSession: checkSessionMock,
    })

    renderAccess()

    expect(screen.getByRole('heading', { name: '로그인 상태를 확인하지 못했어요' }))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(checkSessionMock).toHaveBeenCalledOnce()
  })
})
