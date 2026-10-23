import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  restoreWebPushSubscription,
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
    restoreWebPushSubscription: vi.fn(),
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
vi.mock('../model/webPush.ts', () => ({ restoreWebPushSubscription }))
vi.mock('../../guidebook/model/generation.ts', () => ({ useGeneration: () => state }))

const notification = {
  notification_id: '51',
  title: '가이드북 생성 완료',
  body: "'경주 여행 가이드북' 가이드북이 완성되었습니다.",
  type: 'GUIDEBOOK_COMPLETED',
  reference_type: 'GUIDEBOOK',
  reference_id: '10',
  created_at: '2026-10-06T00:00:00Z',
}

const tripStartingNotification = {
  notification_id: '52',
  title: '여행 일정이 곧 시작돼요',
  body: "'제주 여행' 여행이 내일 시작됩니다.",
  type: 'TRIP_STARTING',
  reference_type: 'GUIDEBOOK',
  reference_id: '11',
  created_at: '2026-10-18T00:00:00Z',
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
    restoreWebPushSubscription.mockResolvedValue(true)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('앱 전역에서 실시간 알림 설정이 켜진 ACTIVE 회원만 한 번 연결한다', async () => {
    renderCenter()

    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())
    expect(getMemberSettings).toHaveBeenCalledOnce()
    expect(restoreWebPushSubscription).toHaveBeenCalledOnce()
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
      name: '경주 여행 가이드북 생성 완료!',
    })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '가이드북 보기' })).toBeInTheDocument()
  })

  it('SSE로 도착한 여행 일정 임박 알림을 서버 문구와 가이드북 동작으로 표시한다', async () => {
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())

    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(tripStartingNotification),
    })))

    expect(await screen.findByRole('status', {
      name: "여행 일정이 곧 시작돼요 '제주 여행' 여행이 내일 시작됩니다.",
    })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '가이드북 보기' }))

    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith('52'))
    await waitFor(() => {
      expect(screen.getByRole('status', { name: '현재 경로' }))
        .toHaveTextContent('/guidebooks:{"highlightGuidebookId":11}')
    })
  })

  it('Web Push로 먼저 받은 같은 알림 ID의 SSE 토스트도 독립 표시한다', async () => {
    const serviceWorker = new EventTarget() as EventTarget & {
      controller: { postMessage: ReturnType<typeof vi.fn> }
    }
    serviceWorker.controller = { postMessage: vi.fn() }
    vi.stubGlobal('navigator', { serviceWorker })
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())

    act(() => serviceWorker.dispatchEvent(new MessageEvent('message', {
      data: { type: 'KGB_WEB_PUSH_RECEIVED', notificationId: '51' },
    })))
    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(notification),
    })))

    expect(await screen.findByRole('button', { name: '가이드북 보기' })).toBeInTheDocument()
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2))
  })

  it('같은 알림 ID의 SSE 이벤트가 반복되면 토스트를 한 번만 대기열에 담는다', async () => {
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())

    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(notification),
    })))
    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(notification),
    })))

    expect(await screen.findAllByRole('button', { name: '가이드북 보기' })).toHaveLength(1)
  })

  it('생성 완료 토스트를 선택하면 읽음 처리 후 가이드북 완성 화면으로 이동한다', async () => {
    renderCenter()
    await waitFor(() => expect(openNotificationStream).toHaveBeenCalledOnce())
    act(() => stream.dispatchEvent(new MessageEvent('notification', {
      data: JSON.stringify(notification),
    })))

    fireEvent.click(await screen.findByRole('button', { name: '가이드북 보기' }))

    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith('51'))
    await waitFor(() => {
      expect(screen.getByRole('status', { name: '현재 경로' }))
        .toHaveTextContent('/guidebooks/10:null')
    })
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
