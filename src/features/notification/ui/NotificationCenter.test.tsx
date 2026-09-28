import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationCenter } from './NotificationCenter.tsx'

const { getNotifications, deleteNotification, state } = vi.hoisted(() => ({
  getNotifications: vi.fn(), deleteNotification: vi.fn(),
  state: { member: { member_id: 1, status: 'ACTIVE', unread_count: 0 }, job: { job_id: 31, status: 'PROCESSING', guidebook_id: null as number | null } },
}))
vi.mock('../api/notifications.ts', () => ({ getNotifications, deleteNotification }))
vi.mock('../../guidebook/model/generation.ts', () => ({ useGeneration: () => state }))
describe('생성 완료 알림', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.job = { job_id: 31, status: 'PROCESSING', guidebook_id: null }
    getNotifications.mockResolvedValue({ items: [], unread_count: 0 })
  })
  it('다른 화면에서도 완료되면 서버 알림을 다시 읽고 개수와 알림 메시지를 표시한다', async () => {
    const view = render(<MemoryRouter initialEntries={['/map']}><NotificationCenter /></MemoryRouter>)
    await act(async () => {})
    getNotifications.mockResolvedValue({
      items: [{ notification_id: '51', title: '가이드북 생성 완료', body: '경주 여행이 완성됐어요.', type: 'GUIDEBOOK_COMPLETED', reference_type: 'GUIDEBOOK', reference_id: '10' }],
      unread_count: 1,
    })
    state.job = { job_id: 31, status: 'COMPLETED', guidebook_id: 10 }
    view.rerender(<MemoryRouter initialEntries={['/map']}><NotificationCenter /></MemoryRouter>)
    expect(await screen.findByRole('button', { name: '알림 1개' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('가이드북 생성 완료')
    fireEvent.click(screen.getByRole('button', { name: '알림 1개' }))
    const link = await screen.findByRole('link', { name: /가이드북 생성 완료/ })
    expect(link).toHaveAttribute('href', '/guidebooks/10')
    expect(deleteNotification).not.toHaveBeenCalled()
    expect(getNotifications.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
