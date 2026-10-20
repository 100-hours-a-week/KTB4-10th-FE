import { describe, expect, it } from 'vitest'
import { parseWebPushReceivedMessage } from './webPushMessages.ts'

describe('Web Push 수신 메시지', () => {
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
})
