import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentMember } from '../../auth/api/auth.ts'
import { NOTIFICATIONS_UPDATED_EVENT } from '../../notification/model/events.ts'
import { MyPage } from './MyPage.tsx'

vi.mock('../../auth/api/auth.ts', () => ({
  getCurrentMember: vi.fn(),
}))

const getCurrentMemberMock = vi.mocked(getCurrentMember)

function CurrentPath() {
  return <output aria-label="현재 경로">{useLocation().pathname}</output>
}

describe('MyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentMemberMock.mockResolvedValue({
      member_id: 1,
      nickname: '여행자',
      email: 'traveler@example.com',
      profile_image_url: 'https://example.com/profile.png',
      language_code: 'ko',
      status: 'ACTIVE',
      unread_count: 2,
    })
  })

  it('회원 정보와 미읽음 알림 상태를 표시한다', async () => {
    render(<MemoryRouter><MyPage /></MemoryRouter>)

    expect(await screen.findByText('여행자')).toBeInTheDocument()
    expect(screen.getByText('traveler@example.com')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '여행자 프로필' })).toHaveAttribute(
      'src',
      'https://example.com/profile.png',
    )
    expect(screen.getByRole('button', { name: '읽지 않은 알림 2개 확인' }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: '읽지 않은 알림 2개 확인' }).querySelector('img'))
      .toHaveAttribute('src', '/assets/mypage/bell-unread.png')
  })

  it('이메일과 프로필 이미지가 없으면 대체 정보를 표시한다', async () => {
    getCurrentMemberMock.mockResolvedValue({
      member_id: 1,
      nickname: '가이드',
      email: null,
      profile_image_url: null,
      language_code: 'ko',
      status: 'ACTIVE',
      unread_count: 0,
    })

    render(<MemoryRouter><MyPage /></MemoryRouter>)

    expect(await screen.findByText('이메일 정보 없음')).toBeInTheDocument()
    expect(screen.getByText('가')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '알림 확인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '알림 확인' }).querySelector('img'))
      .toHaveAttribute('src', '/assets/mypage/bell-empty.png')
  })

  it('생성 완료 알림 갱신 이벤트를 받으면 새로고침 없이 배지를 바꾼다', async () => {
    getCurrentMemberMock.mockResolvedValue({
      member_id: 1,
      nickname: '여행자',
      email: null,
      profile_image_url: null,
      language_code: 'ko',
      status: 'ACTIVE',
      unread_count: 0,
    })
    render(<MemoryRouter><MyPage /></MemoryRouter>)
    await screen.findByRole('button', { name: '알림 확인' })

    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
      detail: { unreadCount: 1 },
    }))

    expect(await screen.findByRole('button', { name: '읽지 않은 알림 1개 확인' }))
      .toBeInTheDocument()
  })

  it('알림, 취향 수정, 설정 경로로 이동한다', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <MemoryRouter initialEntries={['/mypage']}>
        <MyPage />
        <CurrentPath />
      </MemoryRouter>,
    )
    await screen.findByText('여행자')

    await user.click(screen.getByRole('button', { name: '읽지 않은 알림 2개 확인' }))
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/mypage/notifications')
    unmount()

    const preferenceView = render(
      <MemoryRouter initialEntries={['/mypage']}>
        <MyPage />
        <CurrentPath />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: /취향 및 선호 수정/ }))
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/preferences')
    preferenceView.unmount()

    render(
      <MemoryRouter initialEntries={['/mypage']}>
        <MyPage />
        <CurrentPath />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: /설정/ }))
    expect(screen.getByRole('status', { name: '현재 경로' })).toHaveTextContent('/mypage/settings')
  })

  it('회원 정보 조회 실패 후 다시 시도한다', async () => {
    const user = userEvent.setup()
    getCurrentMemberMock
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        member_id: 1,
        nickname: '여행자',
        email: null,
        profile_image_url: null,
        language_code: 'ko',
        status: 'ACTIVE',
        unread_count: 0,
      })

    render(<MemoryRouter><MyPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }))
    await waitFor(() => expect(getCurrentMemberMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('여행자')).toBeInTheDocument()
  })
})
