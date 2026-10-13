import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from '../../../shared/lib/serviceWorker.ts'
import {
  deletePushSubscription,
  getVapidPublicKey,
  savePushSubscription,
} from '../api/pushSubscriptions.ts'
import {
  cleanupWebPushSubscription,
  enableWebPush,
  restoreWebPushSubscription,
} from './webPush.ts'

vi.mock('../../../shared/lib/serviceWorker.ts', () => ({ registerServiceWorker: vi.fn() }))
vi.mock('../api/pushSubscriptions.ts', () => ({
  deletePushSubscription: vi.fn(),
  getVapidPublicKey: vi.fn(),
  savePushSubscription: vi.fn(),
}))

const serializedSubscription = {
  endpoint: 'https://push.example/subscription',
  expirationTime: null,
  keys: { p256dh: 'p256dh', auth: 'auth' },
}

describe('Web Push 브라우저 구독 수명주기', () => {
  const subscribe = vi.fn()
  const getSubscription = vi.fn()
  const getRegistration = vi.fn()
  const registration = { pushManager: { getSubscription, subscribe } }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal('PushManager', class PushManager {})
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(registration),
        getRegistration,
      },
    })
    vi.mocked(registerServiceWorker).mockResolvedValue(registration as never)
    vi.mocked(getVapidPublicKey).mockResolvedValue('AQID')
    vi.mocked(savePushSubscription).mockResolvedValue({
      subscription_id: 7,
      status: 'ACTIVE',
      expiration_time: null,
    })
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('기존 브라우저 구독을 재사용해 서버에 현재 회원 구독으로 등록한다', async () => {
    const existing = { toJSON: () => serializedSubscription }
    getSubscription.mockResolvedValue(existing)

    await enableWebPush()

    expect(Notification.requestPermission).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
    expect(savePushSubscription).toHaveBeenCalledWith({
      endpoint: serializedSubscription.endpoint,
      expiration_time: null,
      keys: serializedSubscription.keys,
    })
    expect(localStorage.getItem('kgb.web-push-subscription-id')).toBe('7')
  })

  it('명시적 활성화에서만 권한을 요청하고 새 구독을 만든다', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    const created = { toJSON: () => serializedSubscription }
    getSubscription.mockResolvedValue(null)
    subscribe.mockResolvedValue(created)

    await enableWebPush()

    expect(Notification.requestPermission).toHaveBeenCalledOnce()
    expect(getVapidPublicKey).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })
  })

  it('자동 복구는 권한이 미결정이면 권한 창을 열지 않는다', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn(),
    })

    await expect(restoreWebPushSubscription()).resolves.toBe(false)

    expect(Notification.requestPermission).not.toHaveBeenCalled()
    expect(registerServiceWorker).not.toHaveBeenCalled()
  })

  it('로그아웃 정리에서 서버와 현재 브라우저 구독을 모두 해제한다', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    getRegistration.mockResolvedValue({
      pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) },
    })
    localStorage.setItem('kgb.web-push-subscription-id', '7')

    await cleanupWebPushSubscription()

    expect(deletePushSubscription).toHaveBeenCalledWith(7)
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(localStorage.getItem('kgb.web-push-subscription-id')).toBeNull()
  })
})
