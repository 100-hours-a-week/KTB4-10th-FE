import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeNotificationStream,
  getNotificationStreamUrl,
  openNotificationStream,
  parseNotificationEvent,
} from './notifications.ts'

const { closeMock, eventSourceConstructor } = vi.hoisted(() => ({
  closeMock: vi.fn(),
  eventSourceConstructor: vi.fn(),
}))

class FakeEventSource extends EventTarget {
  close = closeMock

  constructor(url: string | URL, options?: EventSourceInit) {
    super()
    eventSourceConstructor(url, options)
  }
}

describe('알림 SSE API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    closeNotificationStream()
    vi.unstubAllGlobals()
  })

  it('세션 쿠키를 포함해 알림 스트림을 연결한다', () => {
    openNotificationStream()

    expect(getNotificationStreamUrl()).toMatch(/\/api\/v1\/notifications\/stream$/)
    expect(eventSourceConstructor).toHaveBeenCalledWith(
      getNotificationStreamUrl(),
      { withCredentials: true },
    )
  })

  it('새 연결을 만들 때 기존 전역 연결을 닫는다', () => {
    openNotificationStream()
    openNotificationStream()

    expect(closeMock).toHaveBeenCalledOnce()
  })

  it('notification 이벤트 계약만 화면 알림으로 변환한다', () => {
    const data = JSON.stringify({
      notification_id: '301',
      type: 'GUIDEBOOK_COMPLETED',
      title: '가이드북 완성',
      body: '가이드북을 확인해 주세요.',
      reference_type: 'GUIDEBOOK',
      reference_id: '101',
      created_at: '2026-09-04T00:00:00Z',
    })

    expect(parseNotificationEvent(data)?.notification_id).toBe('301')
    expect(parseNotificationEvent('{잘못된 json')).toBeNull()
    expect(parseNotificationEvent(JSON.stringify({ notification_id: '301' }))).toBeNull()
  })
})
