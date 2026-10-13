const GUIDEBOOK_COMPLETED_TYPE = 'GUIDEBOOK_COMPLETED'
const GUIDEBOOK_REFERENCE_TYPE = 'GUIDEBOOK'
const GUIDEBOOK_NOTIFICATION_TITLE = '가이드북 생성 완료'
const GUIDEBOOK_NOTIFICATION_BODY = '새로운 여행 가이드북이 완성됐어요.'
const NOTIFICATION_LIST_PATH = '/mypage/notifications'
const GUIDEBOOK_LIST_PATH = '/guidebooks'
const WEB_PUSH_RECEIVED_MESSAGE = 'KGB_WEB_PUSH_RECEIVED'
const NOTIFICATION_SEEN_MESSAGE = 'KGB_NOTIFICATION_SEEN'
const MAX_SEEN_NOTIFICATION_IDS = 200
const seenNotificationIds = new Set()

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const id = String(value).trim()
  return id.length > 0 && id.length <= 128 ? id : null
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function parseGuidebookPushPayload(event) {
  if (!event.data) return null
  let raw
  try {
    raw = event.data.json()
  } catch {
    return null
  }
  if (!isRecord(raw)) return null
  const payload = isRecord(raw.data) ? raw.data : raw
  const notificationId = boundedId(payload.notification_id)
  const guidebookId = positiveInteger(payload.reference_id)
  if (
    !notificationId ||
    payload.type !== GUIDEBOOK_COMPLETED_TYPE ||
    payload.reference_type !== GUIDEBOOK_REFERENCE_TYPE ||
    !guidebookId
  ) {
    return null
  }
  return { notificationId, guidebookId }
}

function notificationTarget(guidebookId) {
  return `${GUIDEBOOK_LIST_PATH}?highlightGuidebookId=${guidebookId}`
}

function rememberNotification(notificationId) {
  seenNotificationIds.delete(notificationId)
  seenNotificationIds.add(notificationId)
  if (seenNotificationIds.size > MAX_SEEN_NOTIFICATION_IDS) {
    seenNotificationIds.delete(seenNotificationIds.values().next().value)
  }
}

async function broadcastWebPushReceived(notificationId) {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of windows) {
    client.postMessage({ type: WEB_PUSH_RECEIVED_MESSAGE, notificationId })
  }
}

async function displayGuidebookNotification(payload) {
  const tag = `kgb-notification-${payload.notificationId}`
  const displayed = await self.registration.getNotifications({ tag }).catch(() => [])
  if (seenNotificationIds.has(payload.notificationId) || displayed.length > 0) return

  rememberNotification(payload.notificationId)
  await broadcastWebPushReceived(payload.notificationId).catch(() => undefined)
  await self.registration.showNotification(GUIDEBOOK_NOTIFICATION_TITLE, {
    body: GUIDEBOOK_NOTIFICATION_BODY,
    icon: '/favicon.png',
    badge: '/assets/mypage/bell-unread.png',
    tag,
    renotify: false,
    data: {
      target: notificationTarget(payload.guidebookId),
      notificationId: payload.notificationId,
      referenceType: GUIDEBOOK_REFERENCE_TYPE,
      referenceId: String(payload.guidebookId),
    },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (!isRecord(event.data) || event.data.type !== NOTIFICATION_SEEN_MESSAGE) return
  const notificationId = boundedId(event.data.notificationId)
  if (notificationId) rememberNotification(notificationId)
})

self.addEventListener('push', (event) => {
  const payload = parseGuidebookPushPayload(event)
  if (!payload) return
  event.waitUntil(displayGuidebookNotification(payload))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const notificationId = boundedId(event.notification.data?.notificationId)
  if (notificationId) rememberNotification(notificationId)
  const targetPath = typeof event.notification.data?.target === 'string'
    ? event.notification.data.target
    : NOTIFICATION_LIST_PATH
  const targetUrl = new URL(targetPath, self.location.origin)
  const safeUrl = targetUrl.origin === self.location.origin
    ? targetUrl.href
    : new URL(NOTIFICATION_LIST_PATH, self.location.origin).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    const sameOriginWindows = windows.filter(
      (client) => new URL(client.url).origin === self.location.origin,
    )
    const current = sameOriginWindows.find((client) => client.visibilityState === 'visible')
      ?? sameOriginWindows[0]

    if (current) {
      const navigated = await current.navigate(safeUrl)
      if (navigated) return navigated.focus()
      return current.focus()
    }
    return self.clients.openWindow(safeUrl)
  })())
})
