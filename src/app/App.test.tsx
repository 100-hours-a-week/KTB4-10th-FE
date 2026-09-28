import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

const { getCurrentMemberMock, getPolicyMock, startKakaoLoginMock } = vi.hoisted(
  () => ({
    getCurrentMemberMock: vi.fn(),
    getPolicyMock: vi.fn(),
    startKakaoLoginMock: vi.fn(),
  }),
)

vi.mock('../features/auth/api/auth.ts', async () => {
  const actual = await vi.importActual('../features/auth/api/auth.ts')
  return {
    ...actual,
    getCurrentMember: getCurrentMemberMock,
    startKakaoLogin: startKakaoLoginMock,
  }
})

vi.mock('../features/policy/api/policy.ts', () => ({
  getPolicy: getPolicyMock,
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('V1 로그인 화면에서 카카오 로그인을 시작한다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: /여행을 더 쉽게,\s*가이드북을 더 특별하게/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '로그인' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('KGB 임시 로고')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '카카오로 로그인' }))
    expect(
      screen.getByRole('heading', { name: '로그인 정보를 확인하고 있어요' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(startKakaoLoginMock).toHaveBeenCalledOnce())
  })

  it('개인정보 처리방침을 API에서 조회해 모달에 표시한다', async () => {
    const user = userEvent.setup()
    getPolicyMock.mockResolvedValue({
      policy_type: 'privacy',
      title: '개인정보 처리방침',
      format: 'MARKDOWN',
      content: '# 개인정보 처리방침\n\n회원 정보를 안전하게 처리합니다.',
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '개인정보 처리방침' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      '회원 정보를 안전하게 처리합니다.',
    )
  })

  it('정책 조회 실패 후 모달에서 다시 불러온다', async () => {
    const user = userEvent.setup()
    getPolicyMock
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        policy_type: 'terms',
        title: '이용약관',
        format: 'MARKDOWN',
        content: '# 이용약관\n\n서비스 이용 조건입니다.',
      })

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '이용약관' }))
    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      '서비스 이용 조건입니다.',
    )
    expect(getPolicyMock).toHaveBeenCalledTimes(2)
  })

  it('ONBOARDING 회원을 취향 선택 화면으로 보낸다', async () => {
    getCurrentMemberMock.mockResolvedValue({ status: 'ONBOARDING' })

    render(
      <MemoryRouter initialEntries={['/auth/complete']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: '취향 선택' }),
    ).toBeInTheDocument()
  })

  it('ACTIVE 회원을 지도 화면으로 보낸다', async () => {
    getCurrentMemberMock.mockResolvedValue({ status: 'ACTIVE' })

    render(
      <MemoryRouter initialEntries={['/auth/complete']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()
  })

  it('카카오 로그인 취소 안내를 로그인 화면에 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/auth/error?code=OAUTH_ACCESS_DENIED']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('status', {
        name: '사용자에 의해 로그인이 취소되었습니다.',
      }),
    ).toBeInTheDocument()
  })
})
