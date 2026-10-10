import { beforeEach, describe, expect, it, vi } from 'vitest'
import source from '../../../public/service-worker.js?raw'

type Handler = (event: Record<string, unknown>) => void

function createHarness(windows: Array<Record<string, unknown>> = []) {
  const handlers = new Map<string, Handler>()
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const getNotifications = vi.fn().mockResolvedValue([])
  const matchAll = vi.fn().mockResolvedValue(windows)
  const openWindow = vi.fn().mockResolvedValue(undefined)
  const worker = {
    addEventListener: (name: string, handler: Handler) => handlers.set(name, handler),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    registration: { showNotification, getNotifications },
    clients: { claim: vi.fn().mockResolvedValue(undefined), matchAll, openWindow },
    location: { origin: 'https://kguidebook.site' },
  }
  const executeServiceWorker = new Function('self', 'URL', source)
  executeServiceWorker(worker, URL)

  async function push(payload: unknown) {
    let pending: Promise<unknown> | null = null
    const waitUntil = vi.fn((promise: Promise<unknown>) => { pending = Promise.resolve(promise) })
    handlers.get('push')?.({
      data: { json: () => payload },
      waitUntil,
    })
    if (pending) await pending
    return waitUntil
  }

  async function notificationClick(data: unknown) {
    let pending: Promise<unknown> | null = null
    const close = vi.fn()
    handlers.get('notificationclick')?.({
      notification: { data, close },
      waitUntil: (promise: Promise<unknown>) => { pending = Promise.resolve(promise) },
    })
    if (pending) await pending
    return close
  }

  function message(data: unknown) {
    handlers.get('message')?.({ data })
  }

  return {
    getNotifications,
    matchAll,
    message,
    notificationClick,
    openWindow,
    push,
    showNotification,
  }
}

const guidebookPayload = {
  notification_id: '301',
  type: 'GUIDEBOOK_COMPLETED',
  reference_type: 'GUIDEBOOK',
  reference_id: '101',
}

describe('Web Push Service Worker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('검증된 가이드북 완료 payload를 시스템 알림으로 표시한다', async () => {
    const client = { postMessage: vi.fn(), url: 'https://kguidebook.site/map' }
    const harness = createHarness([client])

    await harness.push(guidebookPayload)

    expect(harness.showNotification).toHaveBeenCalledWith('가이드북 생성 완료', {
      body: '새로운 여행 가이드북이 완성됐어요.',
      icon: '/favicon.png',
      badge: '/assets/mypage/bell-unread.png',
      tag: 'kgb-notification-301',
      renotify: false,
      data: {
        target: '/guidebooks?highlightGuidebookId=101',
        notificationId: '301',
        referenceType: 'GUIDEBOOK',
        referenceId: '101',
      },
    })
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'KGB_WEB_PUSH_RECEIVED',
      notificationId: '301',
    })
  })

  it('필수 ID나 지원 타입이 잘못된 payload는 표시하지 않는다', async () => {
    const harness = createHarness()

    const waitUntil = await harness.push({ ...guidebookPayload, reference_id: 'invalid' })

    expect(waitUntil).not.toHaveBeenCalled()
    expect(harness.showNotification).not.toHaveBeenCalled()
  })

  it('SSE에서 이미 본 동일 알림 ID는 Web Push로 다시 표시하지 않는다', async () => {
    const harness = createHarness()
    harness.message({ type: 'KGB_NOTIFICATION_SEEN', notificationId: '301' })

    await harness.push(guidebookPayload)

    expect(harness.showNotification).not.toHaveBeenCalled()
  })

  it('알림 클릭 시 열린 동일 origin 창을 이동하고 포커스한다', async () => {
    const focused = { focus: vi.fn().mockResolvedValue(undefined) }
    const visibleClient = {
      url: 'https://kguidebook.site/map',
      visibilityState: 'visible',
      navigate: vi.fn().mockResolvedValue(focused),
      focus: vi.fn().mockResolvedValue(undefined),
    }
    const harness = createHarness([visibleClient])

    await harness.notificationClick({
      target: '/guidebooks?highlightGuidebookId=101',
      notificationId: '301',
    })

    expect(visibleClient.navigate).toHaveBeenCalledWith(
      'https://kguidebook.site/guidebooks?highlightGuidebookId=101',
    )
    expect(focused.focus).toHaveBeenCalledOnce()
    expect(harness.openWindow).not.toHaveBeenCalled()
  })

  it('열린 창이 없는 종료 상태에서는 대상 가이드북 목록 창을 연다', async () => {
    const harness = createHarness()

    await harness.notificationClick({
      target: '/guidebooks?highlightGuidebookId=101',
      notificationId: '301',
    })

    expect(harness.openWindow).toHaveBeenCalledWith(
      'https://kguidebook.site/guidebooks?highlightGuidebookId=101',
    )
  })
})
