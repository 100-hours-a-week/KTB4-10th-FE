import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage.tsx'

const {
  getMemberSettingsMock,
  logoutMock,
  notifyRealtimeNotificationSettingChangedMock,
  updatePushEnabledMock,
  withdrawMemberMock,
  enableWebPushMock,
} = vi.hoisted(() => ({
  getMemberSettingsMock: vi.fn(),
  logoutMock: vi.fn(),
  notifyRealtimeNotificationSettingChangedMock: vi.fn(),
  updatePushEnabledMock: vi.fn(),
  withdrawMemberMock: vi.fn(),
  enableWebPushMock: vi.fn(),
}))

vi.mock('../api/settings.ts', () => ({
  logout: logoutMock,
  withdrawMember: withdrawMemberMock,
}))
vi.mock('../../member/api/memberSettings.ts', () => ({
  getMemberSettings: getMemberSettingsMock,
  updatePushEnabled: updatePushEnabledMock,
}))
vi.mock('../../notification/model/events.ts', () => ({
  notifyRealtimeNotificationSettingChanged: notifyRealtimeNotificationSettingChangedMock,
}))
vi.mock('../../notification/model/webPush.ts', () => ({
  enableWebPush: enableWebPushMock,
  webPushErrorMessage: (error: unknown) => error instanceof Error ? error.message : '알림 오류',
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
    getMemberSettingsMock.mockResolvedValue({ language_code: 'ko', push_enabled: false })
    updatePushEnabledMock.mockResolvedValue({ language_code: 'ko', push_enabled: true })
    enableWebPushMock.mockResolvedValue(undefined)
  })

  it('저장된 실시간 알림 설정을 조회해 알림 받기 토글에 반영한다', async () => {
    getMemberSettingsMock.mockResolvedValue({ language_code: 'ko', push_enabled: true })
    renderPage()

    const toggle = await screen.findByRole('checkbox', { name: '알림 받기' })
    expect(toggle).toBeChecked()
    expect(toggle.closest('label')).not.toHaveClass('settings-toggle--interactive')
    expect(screen.queryByText('서비스 준비 중이에요.')).not.toBeInTheDocument()
  })

  it('알림 받기 토글 변경을 저장하고 전역 SSE 연결 설정에 반영한다', async () => {
    const user = userEvent.setup()
    renderPage()
    const toggle = await screen.findByRole('checkbox', { name: '알림 받기' })
    await waitFor(() => expect(toggle).toBeEnabled())

    await user.click(toggle)

    await waitFor(() => expect(updatePushEnabledMock).toHaveBeenCalledWith(true))
    expect(enableWebPushMock).toHaveBeenCalledOnce()
    expect(toggle.closest('label')).toHaveClass('settings-toggle--interactive')
    expect(notifyRealtimeNotificationSettingChangedMock).toHaveBeenCalledWith(true)
    expect(toggle).toBeChecked()
  })

  it('알림 받기를 끄면 저장값과 전역 SSE 연결 설정을 함께 해제한다', async () => {
    const user = userEvent.setup()
    getMemberSettingsMock.mockResolvedValue({ language_code: 'ko', push_enabled: true })
    updatePushEnabledMock.mockResolvedValue({ language_code: 'ko', push_enabled: false })
    renderPage()
    const toggle = await screen.findByRole('checkbox', { name: '알림 받기' })
    await waitFor(() => expect(toggle).toBeEnabled())

    await user.click(toggle)

    await waitFor(() => expect(updatePushEnabledMock).toHaveBeenCalledWith(false))
    expect(notifyRealtimeNotificationSettingChangedMock).toHaveBeenCalledWith(false)
    expect(toggle).not.toBeChecked()
  })

  it('알림 수신 문제 안내에서 iOS와 Android 설정 방법을 확인한다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', {
      name: '알림을 켰지만 수신되지 않나요?',
    }))

    const dialog = screen.getByRole('dialog', { name: '알림 설정 방법' })
    expect(dialog).toHaveTextContent(
      '브라우저의 사이트 알림 권한과 기기의 알림 권한을 모두 허용해야 알림을 받을 수 있어요.',
    )
    expect(dialog).toHaveTextContent('KGB를 홈 화면에 추가해 웹 앱으로 실행해 주세요.')
    expect(dialog).toHaveTextContent('설정 → 알림 → KGB → 알림 허용을 켜 주세요.')
    expect(dialog).toHaveTextContent('설정 → 알림 → 앱 알림으로 이동해 주세요.')
    expect(dialog).toHaveTextContent(
      '사용하는 브라우저 또는 설치된 KGB 웹 앱의 알림을 허용해 주세요.',
    )

    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByRole('dialog', { name: '알림 설정 방법' })).not.toBeInTheDocument()
  })

  it('로그아웃을 확인하면 API를 호출하고 로그인 화면으로 이동한다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(screen.getByRole('dialog', { name: '로그아웃을 하시겠습니까?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '아니요' })).toHaveClass('settings-modal__primary')
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
