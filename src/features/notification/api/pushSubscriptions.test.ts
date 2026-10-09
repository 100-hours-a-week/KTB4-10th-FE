import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureCsrfToken, requestWithCsrf } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'
import {
  deletePushSubscription,
  getVapidPublicKey,
  savePushSubscription,
} from './pushSubscriptions.ts'

vi.mock('../../../shared/api/csrf.ts', () => ({
  ensureCsrfToken: vi.fn(),
  requestWithCsrf: vi.fn(),
}))
vi.mock('../../../shared/api/http.ts', () => ({
  http: { delete: vi.fn(), get: vi.fn() },
}))

describe('Web Push 구독 API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('VAPID 공개키를 백엔드에서 조회한다', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { message: '성공', data: { public_key: 'public-key' } },
    })

    await expect(getVapidPublicKey()).resolves.toBe('public-key')
    expect(http.get).toHaveBeenCalledWith('/api/v1/push/vapid-public-key')
  })

  it('브라우저 구독을 CSRF 보호 요청으로 저장한다', async () => {
    const subscription = {
      endpoint: 'https://push.example/subscription',
      expiration_time: null,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    }
    vi.mocked(requestWithCsrf).mockResolvedValue({
      message: '성공',
      data: { subscription_id: 7, status: 'ACTIVE', expiration_time: null },
    })

    await expect(savePushSubscription(subscription)).resolves.toMatchObject({
      subscription_id: 7,
    })
    expect(requestWithCsrf).toHaveBeenCalledWith({
      method: 'put',
      url: '/api/v1/members/me/push-subscriptions',
      data: subscription,
    })
  })

  it('구독 해제 요청 전에 CSRF 계약을 준비한다', async () => {
    vi.mocked(ensureCsrfToken).mockResolvedValue({
      cookie_name: 'XSRF-TOKEN',
      header_name: 'X-XSRF-TOKEN',
    })
    vi.mocked(http.delete).mockResolvedValue({ status: 204 })

    await deletePushSubscription(7)

    expect(ensureCsrfToken).toHaveBeenCalledOnce()
    expect(http.delete).toHaveBeenCalledWith('/api/v1/members/me/push-subscriptions/7')
  })
})
