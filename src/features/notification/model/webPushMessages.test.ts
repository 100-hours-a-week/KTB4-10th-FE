import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  markServiceWorkerNotificationSeen,
  parseWebPushReceivedMessage,
} from './webPushMessages.ts'

describe('SSE와 Web Push 알림 ID 공유', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('Service Worker가 보낸 Web Push 수신 메시지만 파싱한다', () => {
    expect(parseWebPushReceivedMessage({
      type: 'KGB_WEB_PUSH_RECEIVED',
      notificationId: '301',
    })).toEqual({ type: 'KGB_WEB_PUSH_RECEIVED', notificationId: '301' })
    expect(parseWebPushReceivedMessage({
      type: 'KGB_WEB_PUSH_RECEIVED',
      notificationId: '',
    })).toBeNull()
    expect(parseWebPushReceivedMessage({ type: 'UNKNOWN', notificationId: '301' })).toBeNull()
  })

  it('SSE에서 본 알림 ID를 활성 Service Worker에 전달한다', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('navigator', { serviceWorker: { controller: { postMessage } } })

    markServiceWorkerNotificationSeen('301')

    expect(postMessage).toHaveBeenCalledWith({
      type: 'KGB_NOTIFICATION_SEEN',
      notificationId: '301',
    })
  })
})
