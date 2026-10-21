import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationPage } from './NotificationPage.tsx'
import { NOTIFICATIONS_UPDATED_EVENT } from '../model/events.ts'

const {
  deleteAllNotificationsMock,
  deleteNotificationMock,
  getNotificationsMock,
} = vi.hoisted(() => ({
  deleteAllNotificationsMock: vi.fn(),
  deleteNotificationMock: vi.fn(),
  getNotificationsMock: vi.fn(),
}))

vi.mock('../api/notifications.ts', () => ({
  deleteAllNotifications: deleteAllNotificationsMock,
  deleteNotification: deleteNotificationMock,
  getNotifications: getNotificationsMock,
}))

const olderNotification = {
  notification_id: '10',
  type: 'GUIDEBOOK_COMPLETED',
  title: '부산 가이드북 생성 완료',
  body: '가이드북을 확인해 보세요.',
  reference_type: 'GUIDEBOOK',
  reference_id: '4',
  created_at: '2026-09-28T10:00:00+09:00',
}

const newerNotification = {
  notification_id: '11',
  type: 'GUIDEBOOK_COMPLETED',
  title: '서울 가이드북 생성 완료',
  body: '새 가이드북이 완성됐어요.',
  reference_type: 'GUIDEBOOK',
  reference_id: '5',
  created_at: '2026-09-28T11:00:00+09:00',
}

function response(items = [olderNotification, newerNotification]) {
  return {
    items,
    unread_count: items.length,
    total_items: items.length,
    total_pages: items.length === 0 ? 0 : 1,
    page: 1,
    size: 20,
  }
}

function GuidebookDestination() {
  const location = useLocation()
  return <output aria-label="가이드북 이동 정보">{JSON.stringify(location.state)}</output>
}

function InformationDestination() {
  const location = useLocation()
  return <output aria-label="정보 페이지 query">{location.search}</output>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/mypage/notifications']}>
      <Routes>
        <Route path="/mypage/notifications" element={<NotificationPage />} />
        <Route path="/mypage" element={<h1>마이페이지</h1>} />
        <Route path="/guidebooks" element={<GuidebookDestination />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getNotificationsMock.mockResolvedValue(response())
    deleteNotificationMock.mockResolvedValue(undefined)
    deleteAllNotificationsMock.mockResolvedValue(undefined)
  })

  it('알림을 기다리는 동안 카드 형태의 스켈레톤 세 개를 표시한다', () => {
    getNotificationsMock.mockReturnValue(new Promise(() => undefined))

    const { container } = renderPage()

    expect(screen.getByRole('status', { name: '알림 목록 불러오는 중' })).toBeInTheDocument()
    expect(container.querySelectorAll('.notification-card--skeleton')).toHaveLength(3)
    expect(container.querySelector('.loading-indicator')).not.toBeInTheDocument()
  })

  it('백엔드 응답 순서와 무관하게 최신 알림을 먼저 표시한다', async () => {
    renderPage()

    const cards = await screen.findAllByRole('button', { name: /가이드북 보기/ })
    expect(cards[0]).toHaveTextContent('서울 가이드북 생성 완료')
    expect(cards[1]).toHaveTextContent('부산 가이드북 생성 완료')
  })

  it('정보 페이지에서 진입하면 뒤로가기 버튼으로 기존 필터 query를 복원한다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/mypage/notifications',
        state: { returnTo: '/information?region_code=11&month=2026-10' },
      }]}>
        <Routes>
          <Route path="/mypage/notifications" element={<NotificationPage />} />
          <Route path="/information" element={<InformationDestination />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '이전 화면으로 돌아가기' }))
    expect(await screen.findByRole('status', { name: '정보 페이지 query' }))
      .toHaveTextContent('?region_code=11&month=2026-10')
  })

  it('알림이 없으면 이미지와 빈 상태 문구를 표시한다', async () => {
    getNotificationsMock.mockResolvedValue(response([]))
    renderPage()

    expect(await screen.findByText('새로운 알림이 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '모든 알림 읽음 처리' })).toBeDisabled()
  })

  it('생성 완료 알림 갱신 이벤트를 받으면 열려 있는 목록을 다시 조회한다', async () => {
    getNotificationsMock
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([newerNotification]))
    renderPage()
    await screen.findByText('새로운 알림이 없습니다.')

    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
      detail: { unreadCount: 1 },
    }))

    expect(await screen.findByText('서울 가이드북 생성 완료')).toBeInTheDocument()
    expect(getNotificationsMock).toHaveBeenCalledTimes(2)
  })

  it('카드를 왼쪽으로 밀면 개별 읽음 처리 후 목록에서 제거한다', async () => {
    renderPage()
    const card = (await screen.findAllByRole('button', { name: /가이드북 보기/ }))[0]

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 120 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 120 })

    await waitFor(() => expect(deleteNotificationMock).toHaveBeenCalledWith('11'))
    await waitFor(() => expect(screen.queryByText('서울 가이드북 생성 완료')).not.toBeInTheDocument())
    expect(screen.getByText('부산 가이드북 생성 완료')).toBeInTheDocument()
  })

  it('가이드북 알림을 누르면 읽음 처리 후 대상 정보를 담아 목록으로 이동한다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', {
      name: '서울 가이드북 생성 완료 가이드북 보기',
    }))

    await waitFor(() => expect(deleteNotificationMock).toHaveBeenCalledWith('11'))
    expect(await screen.findByRole('status', { name: '가이드북 이동 정보' }))
      .toHaveTextContent('{"highlightGuidebookId":5}')
  })

  it('가이드북 알림 읽음 처리에 실패하면 이동하지 않고 안내한다', async () => {
    const user = userEvent.setup()
    deleteNotificationMock.mockRejectedValue(new Error('network error'))
    renderPage()

    await user.click(await screen.findByRole('button', {
      name: '서울 가이드북 생성 완료 가이드북 보기',
    }))

    expect(await screen.findByRole('status', {
      name: '읽음 처리에 실패했습니다. 다시 시도해주세요.',
    })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '가이드북 이동 정보' })).not.toBeInTheDocument()
  })

  it('전체 읽음 처리 중 버튼을 비활성화하고 성공 후 빈 상태를 표시한다', async () => {
    const user = userEvent.setup()
    let resolveDelete!: () => void
    deleteAllNotificationsMock.mockImplementation(() => new Promise<void>((resolve) => {
      resolveDelete = resolve
    }))
    renderPage()

    const button = await screen.findByRole('button', { name: '모든 알림 읽음 처리' })
    await user.click(button)
    expect(screen.getByRole('button', { name: '읽음 처리 중...' })).toBeDisabled()

    resolveDelete()
    expect(await screen.findByText('새로운 알림이 없습니다.')).toBeInTheDocument()
  })

  it('읽음 처리 실패 시 목록을 유지하고 토스트를 표시한다', async () => {
    const user = userEvent.setup()
    deleteAllNotificationsMock.mockRejectedValue(new Error('network error'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: '모든 알림 읽음 처리' }))

    expect(await screen.findByRole('status', {
      name: '읽음 처리에 실패했습니다. 다시 시도해주세요.',
    })).toBeInTheDocument()
    expect(screen.getByText('서울 가이드북 생성 완료')).toBeInTheDocument()
  })
})
