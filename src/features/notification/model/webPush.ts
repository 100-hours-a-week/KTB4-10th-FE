import { registerServiceWorker } from '../../../shared/lib/serviceWorker.ts'
import {
  deletePushSubscription,
  getVapidPublicKey,
  savePushSubscription,
  type BrowserPushSubscription,
} from '../api/pushSubscriptions.ts'

const SUBSCRIPTION_ID_STORAGE_KEY = 'kgb.web-push-subscription-id'

type WebPushErrorCode = 'UNSUPPORTED' | 'PERMISSION_DENIED' | 'SUBSCRIPTION_INVALID'

export class WebPushError extends Error {
  readonly code: WebPushErrorCode

  constructor(code: WebPushErrorCode, message: string) {
    super(message)
    this.name = 'WebPushError'
    this.code = code
  }
}

function supportsWebPush(): boolean {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const decoded = window.atob(base64)
  const buffer = new ArrayBuffer(decoded.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

function subscriptionPayload(subscription: PushSubscription): BrowserPushSubscription {
  const serialized = subscription.toJSON()
  const p256dh = serialized.keys?.p256dh
  const auth = serialized.keys?.auth
  if (!serialized.endpoint || !p256dh || !auth) {
    throw new WebPushError('SUBSCRIPTION_INVALID', '브라우저 구독 정보가 올바르지 않습니다.')
  }
  return {
    endpoint: serialized.endpoint,
    expiration_time: serialized.expirationTime ?? null,
    keys: { p256dh, auth },
  }
}

function saveSubscriptionId(subscriptionId: number): void {
  try {
    localStorage.setItem(SUBSCRIPTION_ID_STORAGE_KEY, String(subscriptionId))
  } catch {
    // 구독 ID는 로그아웃 정리를 돕는 보조 정보이며 저장 실패가 수신 등록을 막지 않습니다.
  }
}

function storedSubscriptionId(): number | null {
  try {
    const value = Number(localStorage.getItem(SUBSCRIPTION_ID_STORAGE_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function clearSubscriptionId(): void {
  try {
    localStorage.removeItem(SUBSCRIPTION_ID_STORAGE_KEY)
  } catch {
    // 브라우저 저장소 접근이 막혀도 로그아웃은 계속 진행합니다.
  }
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await registerServiceWorker()
  if (!registration) {
    throw new WebPushError('UNSUPPORTED', '이 브라우저에서는 알림을 사용할 수 없습니다.')
  }
  return navigator.serviceWorker.ready
}

async function registerCurrentBrowser(): Promise<void> {
  const registration = await readyRegistration()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const publicKey = await getVapidPublicKey()
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey),
    })
  }
  const saved = await savePushSubscription(subscriptionPayload(subscription))
  saveSubscriptionId(saved.subscription_id)
}

export async function enableWebPush(): Promise<void> {
  if (!supportsWebPush()) {
    throw new WebPushError('UNSUPPORTED', '이 브라우저에서는 알림을 사용할 수 없습니다.')
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    throw new WebPushError(
      'PERMISSION_DENIED',
      '브라우저 알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요.',
    )
  }
  await registerCurrentBrowser()
}

export async function restoreWebPushSubscription(): Promise<boolean> {
  if (!supportsWebPush() || Notification.permission !== 'granted') return false
  await registerCurrentBrowser()
  return true
}

export async function cleanupWebPushSubscription(): Promise<void> {
  if (!supportsWebPush()) {
    clearSubscriptionId()
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const browserSubscription = await registration?.pushManager.getSubscription() ?? null
  const subscriptionId = storedSubscriptionId()

  if (subscriptionId) {
    await deletePushSubscription(subscriptionId).catch(() => undefined)
  }
  if (browserSubscription) {
    await browserSubscription.unsubscribe().catch(() => false)
  }
  clearSubscriptionId()
}

export function webPushErrorMessage(error: unknown): string {
  if (error instanceof WebPushError) return error.message
  return '알림 설정을 변경하지 못했습니다. 다시 시도해주세요.'
}
