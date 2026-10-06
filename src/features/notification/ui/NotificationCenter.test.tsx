import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  notifyRealtimeNotificationSettingChanged,
  NOTIFICATIONS_UPDATED_EVENT,
} from '../model/events.ts'
import { NotificationCenter } from './NotificationCenter.tsx'

const {
  closeNotificationStream,
  deleteNotification,
  getMemberSettings,
  getNotifications,
  openNotificationStream,
  parseNotificationEvent,
  state,
  stream,
} = vi.hoisted(() => {
  const eventTarget = new EventTarget() as EventSource
  return {
    closeNotificationStream: vi.fn(),
    deleteNotification: vi.fn(),
    getMemberSettings: vi.fn(),
    getNotifications: vi.fn(),
    openNotificationStream: vi.fn(() => eventTarget),
    parseNotificationEvent: vi.fn((data: string) => JSON.parse(data)),
    state: {
      member: { member_id: 1, status: 'ACTIVE', unread_count: 0 },
      job: { job_id: 31, status: 'PROCESSING', guidebook_id: null as number | null },
    },
    stream: eventTarget,
  }
})

vi.mock('../api/notifications.ts', () => ({
  closeNotificationStream,
  deleteNotification,
  getNotifications,
  openNotificationStream,
  parseNotificationEvent,
}))
vi.mock('../../member/api/memberSettings.ts', () => ({ getMemberSettings }))
vi.mock('../../guidebook/model/generation.ts', () => ({ useGeneration: () => state }))

const notification = {
  notification_id: '51',
  title: '가이드북 생성 완료',
  body: '경주 여행이 완성됐어요.',
  type: 'GUIDEBOOK_COMPLETED',
  reference_type: 'GUIDEBOOK',
  reference_id: '10',
  created_at: '2026-10-06T00:00:00Z',
}

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="현재 경로">{location.pathname}:{JSON.stringify(location.state)}</output>
}

function renderCenter() {
  return render(
    <MemoryRouter initialEntries={['/map']}>
      <NotificationCenter />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('전역 SSE 알림 센터', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.member = { member_id: 1, status: 'ACTIVE', unread_count: 0 }
    state.job = { job_id: 31, status: 'PROCESSING', guidebook_id: null }
    getMemberSettings.mockResolvedValue({ language_code: 'ko', push_enabled: true })
    getNotifications.mockResolvedValue({ items: [], unread_count: 0 })
    deleteNotification.mockResolvedValue(undefined)
  })

  it('앱 전역에서 실시간 알림 설정이 켜진 ACTIVE 회원만 한 번 연결한다', async () => {
    renderCenter()

    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())
    expect(getMemberSettings).toHaveBeenCalledOnce()
  })

  it('실시간 알림 설정이 꺼진 회원은 새 연결을 만들지 않는다', async () => {
    getMemberSettings.mockResolvedValue({ language_code: 'ko', push_enabled: false })
    renderCenter()

    await waitFor(() => expect(getMemberSettings).toHaveBeenCalledOnce())
    expect(openNotificationStream).not.toHaveBeenCalled()
  })

  it('connected 이벤트는 토스트 없이 목록과 배지만 복구한다', async () => {
    const updated = vi.fn()
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, updated)
    getNotifications.mockResolvedValue({ items: [notification], unread_count: 1 })
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())

    act(() => stream.dispatchEvent(new Event('connected')))

    await waitFor(() => expect(getNotifications).toHaveBeenCalledOnce())
    expect(updated).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: '가이드북 보기' })).not.toBeInTheDocument()
    window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, updated)
  })

  it('SSE로 새로 도착한 notification 이벤트에만 실행 가능한 토스트를 표시한다', async () => {
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())

    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(notification),
    })))

    expect(await screen.findByRole('status', {
      name: '가이드북 생성 완료 경주 여행이 완성됐어요.',
    })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '가이드북 보기' })).toBeInTheDocument()
  })

  it('토스트를 선택하면 읽음 처리 후 대상 가이드북 정보를 담아 목록으로 이동한다', async () => {
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())
    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(notification),
    })))

    fireEvent.click(await screen.findByRole('button', { name: '가이드북 보기' }))

    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith('51'))
    expect(screen.getByRole('status', { name: '현재 경로' }))
      .toHaveTextContent('/guidebooks:{"highlightGuidebookId":10}')
  })

  it('실시간 알림 설정이 꺼지면 연결을 닫고 다시 만들지 않는다', async () => {
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())

    act(() => notifyRealtimeNotificationSettingChanged(false))

    await waitFor(() => expect(closeNotificationStream).toHaveBeenCalled())
    expect(openNotificationStream).toHaveBeenCalledTimes(1)
  })

  it('생성 완료 폴링은 SSE 토스트를 재생하지 않고 목록과 배지만 복구한다', async () => {
    const view = renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())
    state.job = { job_id: 31, status: 'COMPLETED', guidebook_id: 10 }
    view.rerender(
      <MemoryRouter initialEntries={['/map']}>
        <NotificationCenter />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getNotifications).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: '가이드북 보기' })).not.toBeInTheDocument()
  })
})
