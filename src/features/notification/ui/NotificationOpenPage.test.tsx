import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationOpenPage } from './NotificationOpenPage.tsx'

const { deleteNotificationMock, getNotificationsMock } = vi.hoisted(() => ({
  deleteNotificationMock: vi.fn(),
  getNotificationsMock: vi.fn(),
}))

vi.mock('../api/notifications.ts', () => ({
  deleteNotification: deleteNotificationMock,
  getNotifications: getNotificationsMock,
}))

function Destination() {
  const location = useLocation()
  return <output aria-label="가이드북 이동 정보">{JSON.stringify(location.state)}</output>
}

describe('Web Push 알림 열기 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteNotificationMock.mockResolvedValue(undefined)
    getNotificationsMock.mockResolvedValue({ unread_count: 0, items: [] })
  })

  it('알림을 읽음 처리한 뒤 대상 가이드북 목록으로 이동한다', async () => {
    render(
      <MemoryRouter initialEntries={['/notifications/open?notificationId=301&guidebookId=101']}>
        <Routes>
          <Route path="/notifications/open" element={<NotificationOpenPage />} />
          <Route path="/guidebooks" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(deleteNotificationMock).toHaveBeenCalledWith('301'))
    expect(await screen.findByRole('status', { name: '가이드북 이동 정보' }))
      .toHaveTextContent('{"highlightGuidebookId":101}')
  })

  it('필수 식별자가 올바르지 않으면 알림 목록으로 돌아간다', async () => {
    render(
      <MemoryRouter initialEntries={['/notifications/open?notificationId=301']}>
        <Routes>
          <Route path="/notifications/open" element={<NotificationOpenPage />} />
          <Route path="/mypage/notifications" element={<h1>알림 목록</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '알림 목록' })).toBeInTheDocument()
    expect(deleteNotificationMock).not.toHaveBeenCalled()
  })
})
