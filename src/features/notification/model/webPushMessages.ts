const WEB_PUSH_RECEIVED_MESSAGE = 'KGB_WEB_PUSH_RECEIVED'
const NOTIFICATION_SEEN_MESSAGE = 'KGB_NOTIFICATION_SEEN'

type WebPushReceivedMessage = {
  type: typeof WEB_PUSH_RECEIVED_MESSAGE
  notificationId: string
}

function validNotificationId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128
}

export function parseWebPushReceivedMessage(value: unknown): WebPushReceivedMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const message = value as Record<string, unknown>
  if (
    message.type !== WEB_PUSH_RECEIVED_MESSAGE ||
    !validNotificationId(message.notificationId)
  ) {
    return null
  }
  return {
    type: WEB_PUSH_RECEIVED_MESSAGE,
    notificationId: message.notificationId,
  }
}

export function markServiceWorkerNotificationSeen(notificationId: string): void {
  if (!('serviceWorker' in navigator) || !validNotificationId(notificationId)) return
  navigator.serviceWorker.controller?.postMessage({
    type: NOTIFICATION_SEEN_MESSAGE,
    notificationId,
  })
}
