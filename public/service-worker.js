const GUIDEBOOK_COMPLETED_TYPE = 'GUIDEBOOK_COMPLETED'
const TRIP_STARTING_TYPE = 'TRIP_STARTING'
const EVENT_CHANGED_TYPE = 'EVENT_CHANGED'
const NEW_EVENTS_ADDED_TYPE = 'NEW_EVENTS_ADDED'
const GUIDEBOOK_REFERENCE_TYPE = 'GUIDEBOOK'
const EVENT_REFERENCE_TYPE = 'EVENT'
const EVENT_LIST_REFERENCE_TYPE = 'EVENT_LIST'
const NOTIFICATION_LIST_PATH = '/mypage/notifications'
const NOTIFICATION_OPEN_PATH = '/notifications/open'
const WEB_PUSH_RECEIVED_MESSAGE = 'KGB_WEB_PUSH_RECEIVED'
const MAX_SEEN_NOTIFICATION_IDS = 200
const seenWebPushNotificationIds = new Set()

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

function isoDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? value
    : null
}

function notificationCopy(type) {
  if (type === GUIDEBOOK_COMPLETED_TYPE) {
    return {
      title: '가이드북 생성 완료',
      body: '새로운 여행 가이드북이 완성됐어요.',
    }
  }
  if (type === TRIP_STARTING_TYPE) {
    return {
      title: '여행 일정이 곧 시작돼요',
      body: '내일 시작하는 여행 가이드북을 확인해 주세요.',
    }
  }
  if (type === EVENT_CHANGED_TYPE) {
    return {
      title: '관심 행사 정보가 변경됐어요',
      body: '저장한 행사의 새로운 정보를 확인해 보세요.',
    }
  }
  if (type === NEW_EVENTS_ADDED_TYPE) {
    return {
      title: '새로운 행사가 추가됐어요!',
      body: '새로 등록된 행사들을 확인해 보세요.',
    }
  }
  return null
}

function parsePushPayload(event) {
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
  const copy = notificationCopy(payload.type)
  const isNewEventDigest = (
    payload.reference_type === EVENT_LIST_REFERENCE_TYPE &&
    payload.type === NEW_EVENTS_ADDED_TYPE
  )
  const referenceId = isNewEventDigest
    ? isoDate(payload.reference_id)
    : positiveInteger(payload.reference_id)
  const validReference = (
    payload.reference_type === GUIDEBOOK_REFERENCE_TYPE &&
    (payload.type === GUIDEBOOK_COMPLETED_TYPE || payload.type === TRIP_STARTING_TYPE)
  ) || (
    payload.reference_type === EVENT_REFERENCE_TYPE && payload.type === EVENT_CHANGED_TYPE
  ) || (
    isNewEventDigest
  )
  if (
    !notificationId ||
    !copy ||
    !validReference ||
    !referenceId
  ) {
    return null
  }
  return {
    notificationId,
    referenceId,
    referenceType: payload.reference_type,
    type: payload.type,
    copy,
  }
}

function notificationTarget(notificationId, referenceType, referenceId, type) {
  const query = referenceType === GUIDEBOOK_REFERENCE_TYPE
    ? new URLSearchParams({
        notificationId,
        guidebookId: String(referenceId),
        type,
      })
    : new URLSearchParams({
        notificationId,
        referenceType,
        referenceId: String(referenceId),
        type,
      })
  return `${NOTIFICATION_OPEN_PATH}?${query.toString()}`
}

function rememberWebPushNotification(notificationId) {
  seenWebPushNotificationIds.delete(notificationId)
  seenWebPushNotificationIds.add(notificationId)
  if (seenWebPushNotificationIds.size > MAX_SEEN_NOTIFICATION_IDS) {
    seenWebPushNotificationIds.delete(seenWebPushNotificationIds.values().next().value)
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

async function displayNotification(payload) {
  const tag = `kgb-notification-${payload.notificationId}`
  const displayed = await self.registration.getNotifications({ tag }).catch(() => [])
  if (seenWebPushNotificationIds.has(payload.notificationId) || displayed.length > 0) return

  rememberWebPushNotification(payload.notificationId)
  await broadcastWebPushReceived(payload.notificationId).catch(() => undefined)
  await self.registration.showNotification(payload.copy.title, {
    body: payload.copy.body,
    icon: '/favicon.png',
    badge: '/assets/mypage/bell-unread.png',
    tag,
    renotify: false,
    data: {
      target: notificationTarget(
        payload.notificationId,
        payload.referenceType,
        payload.referenceId,
        payload.type,
      ),
      notificationId: payload.notificationId,
      notificationType: payload.type,
      referenceType: payload.referenceType,
      referenceId: String(payload.referenceId),
    },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event)
  if (!payload) return
  event.waitUntil(displayNotification(payload))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const notificationId = boundedId(event.notification.data?.notificationId)
  if (notificationId) rememberWebPushNotification(notificationId)
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
