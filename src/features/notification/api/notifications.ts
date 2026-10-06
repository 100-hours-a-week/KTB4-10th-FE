import { http } from '../../../shared/api/http.ts'
import { ensureCsrfToken } from '../../../shared/api/csrf.ts'
import type { ApiResponse } from '../../../shared/api/types.ts'

const NOTIFICATION_STREAM_PATH = '/api/v1/notifications/stream'
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
let activeNotificationStream: EventSource | null = null

export type Notification = {
  notification_id: string
  type: string
  title: string
  body: string
  reference_type: string
  reference_id: string
  created_at: string
}
export type Notifications = { items: Notification[]; unread_count: number; total_items: number; total_pages: number; page: number; size: number }

function isNotification(value: unknown): value is Notification {
  if (typeof value !== 'object' || value === null) return false
  const notification = value as Record<string, unknown>
  return (
    typeof notification.notification_id === 'string' &&
    typeof notification.type === 'string' &&
    typeof notification.title === 'string' &&
    typeof notification.body === 'string' &&
    typeof notification.reference_type === 'string' &&
    typeof notification.reference_id === 'string' &&
    typeof notification.created_at === 'string'
  )
}

export function parseNotificationEvent(data: string): Notification | null {
  try {
    const value: unknown = JSON.parse(data)
    return isNotification(value) ? value : null
  } catch {
    return null
  }
}

export function getNotificationStreamUrl(): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${NOTIFICATION_STREAM_PATH}`
}

export function openNotificationStream(): EventSource {
  activeNotificationStream?.close()
  const stream = new EventSource(getNotificationStreamUrl(), { withCredentials: true })
  activeNotificationStream = stream
  return stream
}

export function closeNotificationStream(stream?: EventSource): void {
  if (stream && activeNotificationStream !== stream) {
    stream.close()
    return
  }
  activeNotificationStream?.close()
  activeNotificationStream = null
}

export async function getNotifications(signal?: AbortSignal): Promise<Notifications> {
  // 백엔드가 회원별 최신 20개만 보관합니다.
  return (await http.get<ApiResponse<Notifications>>('/api/v1/notifications', { params: { page: 1, size: 20 }, signal })).data.data
}
export async function deleteNotification(id: string): Promise<void> {
  await ensureCsrfToken()
  await http.delete(`/api/v1/notifications/${encodeURIComponent(id)}`)
}

export async function deleteAllNotifications(): Promise<void> {
  await ensureCsrfToken()
  await http.delete('/api/v1/notifications')
}
