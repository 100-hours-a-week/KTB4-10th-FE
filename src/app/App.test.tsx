import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

const {
  getCurrentMemberMock,
  getMemberPreferencesMock,
  getPolicyMock,
  getPreferenceOptionsMock,
  replaceMemberPreferencesMock,
  startKakaoLoginMock,
  trackEventMock,
} = vi.hoisted(
  () => ({
    getCurrentMemberMock: vi.fn(),
    getMemberPreferencesMock: vi.fn(),
    getPolicyMock: vi.fn(),
    getPreferenceOptionsMock: vi.fn(),
    replaceMemberPreferencesMock: vi.fn(),
    startKakaoLoginMock: vi.fn(),
    trackEventMock: vi.fn(),
  }),
)

vi.mock('../shared/lib/analytics.ts', () => ({ trackEvent: trackEventMock }))

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

vi.mock('../features/preference/api/preferences.ts', () => ({
  getMemberPreferences: getMemberPreferencesMock,
  getPreferenceOptions: getPreferenceOptionsMock,
  replaceMemberPreferences: replaceMemberPreferencesMock,
}))

const preferenceOptions = [
  {
    preference_type: 'THEME',
    code: 'NATURE',
    label: '자연',
    parent_code: null,
    sort_order: 10,
  },
  {
    preference_type: 'DETAIL',
    code: 'NATURE_MOUNTAIN',
    label: '산',
    parent_code: 'NATURE',
    sort_order: 10,
  },
]

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMemberPreferencesMock.mockResolvedValue([])
    getPreferenceOptionsMock.mockResolvedValue([])
    replaceMemberPreferencesMock.mockResolvedValue({ status: 'ACTIVE', selections: [] })
    getCurrentMemberMock.mockRejectedValue(new Error('unauthorized'))
  })

  it('V1 로그인 화면에서 카카오 로그인을 시작한다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        name: /여행을 더 쉽게,\s*가이드북을 더 특별하게/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /여행을 더 쉽게,\s*가이드북을 더 특별하게/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '로그인' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('KGB 임시 로고')).toBeInTheDocument()
    expect(getMemberPreferencesMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '카카오로 로그인' }))
    expect(
      screen.getByRole('heading', { name: '로그인 정보를 확인하고 있어요' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(startKakaoLoginMock).toHaveBeenCalledOnce())
  })

  it('로그인된 ACTIVE 회원이 루트에 접근하면 지도로 이동한다', async () => {
    getCurrentMemberMock.mockResolvedValue({ status: 'ACTIVE' })
    getMemberPreferencesMock.mockResolvedValue([
      { preference_type: 'THEME', preference_code: 'NATURE' },
    ])

    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: '개인정보 처리방침' }))

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

    await user.click(await screen.findByRole('button', { name: '이용약관' }))
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
    expect(trackEventMock).toHaveBeenCalledWith('login', { method: 'kakao' })
  })

  it('ACTIVE 회원을 지도 화면으로 보낸다', async () => {
    getCurrentMemberMock.mockResolvedValue({ status: 'ACTIVE' })
    getMemberPreferencesMock.mockResolvedValue([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ])

    render(
      <MemoryRouter initialEntries={['/auth/complete']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()
  })

  it('ACTIVE 상태여도 저장된 취향이 없으면 취향 선택 화면으로 보낸다', async () => {
    getCurrentMemberMock.mockResolvedValue({ status: 'ACTIVE' })
    getMemberPreferencesMock.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/auth/complete']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: '취향 선택' }),
    ).toBeInTheDocument()
  })

  it('ONBOARDING 회원이 최초 취향을 저장하면 최신 ACTIVE 상태를 확인하고 지도로 이동한다', async () => {
    const user = userEvent.setup()
    let memberStatus = 'ONBOARDING'
    getCurrentMemberMock.mockImplementation(() => Promise.resolve({ status: memberStatus }))
    getPreferenceOptionsMock.mockResolvedValue(preferenceOptions)
    replaceMemberPreferencesMock.mockImplementation(() => {
      memberStatus = 'ACTIVE'
      return Promise.resolve({ status: 'ACTIVE', selections: [] })
    })

    render(
      <MemoryRouter initialEntries={['/preferences']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '자연' }))
    await user.click(screen.getByRole('button', { name: '산' }))
    const memberRequestCountBeforeSubmit = getCurrentMemberMock.mock.calls.length
    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()
    expect(getCurrentMemberMock.mock.calls.length).toBeGreaterThan(memberRequestCountBeforeSubmit)
    expect(replaceMemberPreferencesMock).toHaveBeenCalledWith([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ])
  })

  it('보호 화면에서 세션이 만료되면 로그인 화면에서 재로그인을 안내한다', async () => {
    getCurrentMemberMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    })

    render(
      <MemoryRouter initialEntries={['/map']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '카카오로 로그인' })).toBeInTheDocument()
    expect(screen.getByRole('status', {
      name: '다시 로그인해 주세요.',
    })).toBeInTheDocument()
  })

  it('일시적인 회원 조회 오류는 로그아웃 처리하지 않고 다시 시도한다', async () => {
    const user = userEvent.setup()
    getCurrentMemberMock
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
      .mockResolvedValue({ status: 'ACTIVE' })

    render(
      <MemoryRouter initialEntries={['/map']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인 상태를 확인하지 못했어요')
    expect(screen.queryByRole('button', { name: '카카오로 로그인' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

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
