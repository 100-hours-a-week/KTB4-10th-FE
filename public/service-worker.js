const DEFAULT_NOTIFICATION_TITLE = 'KGB'
const DEFAULT_NOTIFICATION_BODY = '새로운 여행 알림이 도착했어요.'
const NOTIFICATION_LIST_PATH = '/mypage/notifications'
const GUIDEBOOK_LIST_PATH = '/guidebooks'

function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function notificationTarget(payload) {
  const data = payload && typeof payload.data === 'object' ? payload.data : payload
  const referenceType = data?.reference_type ?? payload?.reference_type
  const guidebookId = positiveInteger(
    data?.reference_id
      ?? data?.guidebook_id
      ?? payload?.reference_id
      ?? payload?.guidebook_id,
  )

  if (referenceType === 'GUIDEBOOK' && guidebookId) {
    return `${GUIDEBOOK_LIST_PATH}?highlightGuidebookId=${guidebookId}`
  }
  return NOTIFICATION_LIST_PATH
}

function pushPayload(event) {
  if (!event.data) return {}
  try {
    return event.data.json()
  } catch {
    return { body: event.data.text() }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const payload = pushPayload(event)
  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title
    : DEFAULT_NOTIFICATION_TITLE
  const body = typeof payload.body === 'string' && payload.body.trim()
    ? payload.body
    : DEFAULT_NOTIFICATION_BODY
  const notificationId = payload.notification_id ?? payload.data?.notification_id

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.png',
    badge: '/assets/mypage/bell-unread.png',
    tag: notificationId ? `kgb-notification-${notificationId}` : undefined,
    data: { target: notificationTarget(payload) },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
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
    const current = windows.find((client) => new URL(client.url).origin === self.location.origin)

    if (current) {
      const navigated = await current.navigate(safeUrl)
      if (navigated) return navigated.focus()
    }
    return self.clients.openWindow(safeUrl)
  })())
})
