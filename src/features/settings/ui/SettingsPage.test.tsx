import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage.tsx'

const { logoutMock, withdrawMemberMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  withdrawMemberMock: vi.fn(),
}))

vi.mock('../api/settings.ts', () => ({
  logout: logoutMock,
  withdrawMember: withdrawMemberMock,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/mypage/settings']}>
      <Routes>
        <Route path="/mypage/settings" element={<SettingsPage />} />
        <Route path="/mypage" element={<h1>마이페이지</h1>} />
        <Route path="/" element={<h1>로그인</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    logoutMock.mockResolvedValue(undefined)
    withdrawMemberMock.mockResolvedValue(undefined)
  })

  it('V1에서 푸시 알림 토글을 준비 중 상태로 비활성화한다', () => {
    renderPage()

    expect(screen.getByRole('checkbox', { name: '푸시 알림 준비 중' })).toBeDisabled()
    expect(screen.getByText('서비스 준비 중이에요.')).toBeInTheDocument()
  })

  it('로그아웃을 확인하면 API를 호출하고 로그인 화면으로 이동한다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(screen.getByRole('dialog', { name: '로그아웃을 하시겠습니까?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '예' }))

    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce())
    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
  })

  it('회원 탈퇴 주의사항 확인 후 정확한 확인 문구를 입력해야 탈퇴할 수 있다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '회원 탈퇴' }))
    const continueButton = screen.getByRole('button', { name: '계속' })
    expect(continueButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: '위 내용을 확인했습니다.' }))
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)

    const withdrawalButton = screen.getByRole('button', { name: '탈퇴하기' })
    expect(withdrawalButton).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '회원 탈퇴 확인 문구' }), '회원탈퇴')
    expect(withdrawalButton).toBeDisabled()
    await user.clear(screen.getByRole('textbox', { name: '회원 탈퇴 확인 문구' }))
    await user.type(screen.getByRole('textbox', { name: '회원 탈퇴 확인 문구' }), '회원 탈퇴')
    expect(withdrawalButton).toBeEnabled()

    await user.click(withdrawalButton)
    await waitFor(() => expect(withdrawMemberMock).toHaveBeenCalledOnce())
    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
  })

  it('회원 탈퇴 실패 시 모달을 닫고 설정 화면에서 토스트를 표시한다', async () => {
    const user = userEvent.setup()
    withdrawMemberMock.mockRejectedValue(new Error('network error'))
    renderPage()

    await user.click(screen.getByRole('button', { name: '회원 탈퇴' }))
    await user.click(screen.getByRole('checkbox', { name: '위 내용을 확인했습니다.' }))
    await user.click(screen.getByRole('button', { name: '계속' }))
    await user.type(screen.getByRole('textbox', { name: '회원 탈퇴 확인 문구' }), '회원 탈퇴')
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))

    expect(await screen.findByRole('status', { name: '회원 탈퇴에 실패했습니다.' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
  })
})
