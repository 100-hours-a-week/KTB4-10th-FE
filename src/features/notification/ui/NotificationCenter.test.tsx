import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTIFICATIONS_UPDATED_EVENT } from '../model/events.ts'
import { NotificationCenter } from './NotificationCenter.tsx'

const { getNotifications, state } = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  state: { member: { member_id: 1, status: 'ACTIVE', unread_count: 0 }, job: { job_id: 31, status: 'PROCESSING', guidebook_id: null as number | null } },
}))
vi.mock('../api/notifications.ts', () => ({ getNotifications }))
vi.mock('../../guidebook/model/generation.ts', () => ({ useGeneration: () => state }))
describe('생성 완료 알림', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.job = { job_id: 31, status: 'PROCESSING', guidebook_id: null }
    getNotifications.mockResolvedValue({ items: [], unread_count: 0 })
  })
  it('완료 전에는 알림 UI와 추가 조회를 만들지 않는다', async () => {
    render(<MemoryRouter initialEntries={['/map']}><NotificationCenter /></MemoryRouter>)
    await act(async () => {})

    expect(getNotifications).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /알림/ })).not.toBeInTheDocument()
  })

  it('완료되면 서버 알림을 다시 읽고 갱신 이벤트와 알림 메시지를 표시한다', async () => {
    const updated = vi.fn()
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, updated)
    const view = render(<MemoryRouter initialEntries={['/map']}><NotificationCenter /></MemoryRouter>)
    await act(async () => {})
    getNotifications.mockResolvedValue({
      items: [{ notification_id: '51', title: '가이드북 생성 완료', body: '경주 여행이 완성됐어요.', type: 'GUIDEBOOK_COMPLETED', reference_type: 'GUIDEBOOK', reference_id: '10' }],
      unread_count: 1,
    })
    state.job = { job_id: 31, status: 'COMPLETED', guidebook_id: 10 }
    view.rerender(<MemoryRouter initialEntries={['/map']}><NotificationCenter /></MemoryRouter>)
    expect(await screen.findByRole('status')).toHaveTextContent('가이드북 생성 완료')
    expect(updated).toHaveBeenCalledTimes(1)
    expect((updated.mock.calls[0][0] as CustomEvent).detail).toEqual({ unreadCount: 1 })
    expect(screen.queryByRole('button', { name: /알림/ })).not.toBeInTheDocument()
    expect(getNotifications).toHaveBeenCalledTimes(1)
    window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, updated)
  })
})
