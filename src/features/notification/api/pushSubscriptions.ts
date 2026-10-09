import { ensureCsrfToken, requestWithCsrf } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

type VapidPublicKeyResponse = {
  public_key: string
}

export type BrowserPushSubscription = {
  endpoint: string
  expiration_time: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

type SavedPushSubscription = {
  subscription_id: number
  status: 'ACTIVE'
  expiration_time: number | null
}

function isVapidPublicKeyResponse(value: unknown): value is VapidPublicKeyResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).public_key === 'string'
  )
}

function isSavedPushSubscription(value: unknown): value is SavedPushSubscription {
  if (typeof value !== 'object' || value === null) return false
  const subscription = value as Record<string, unknown>
  return (
    typeof subscription.subscription_id === 'number' &&
    subscription.status === 'ACTIVE' &&
    (subscription.expiration_time === null || typeof subscription.expiration_time === 'number')
  )
}

export async function getVapidPublicKey(): Promise<string> {
  const response = await http.get<unknown>('/api/v1/push/vapid-public-key')
  if (!isApiResponse(response.data) || !isVapidPublicKeyResponse(response.data.data)) {
    throw new Error('VAPID 공개키 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data.public_key
}

export async function savePushSubscription(
  subscription: BrowserPushSubscription,
): Promise<SavedPushSubscription> {
  const response = await requestWithCsrf<SavedPushSubscription, BrowserPushSubscription>({
    method: 'put',
    url: '/api/v1/members/me/push-subscriptions',
    data: subscription,
  })
  if (!isSavedPushSubscription(response.data)) {
    throw new Error('Web Push 구독 저장 응답 계약이 올바르지 않습니다.')
  }
  return response.data
}

export async function deletePushSubscription(subscriptionId: number): Promise<void> {
  await ensureCsrfToken()
  await http.delete(`/api/v1/members/me/push-subscriptions/${subscriptionId}`)
}
