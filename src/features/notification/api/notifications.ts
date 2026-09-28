import { http } from '../../../shared/api/http.ts'
import { ensureCsrfToken } from '../../../shared/api/csrf.ts'
import type { ApiResponse } from '../../../shared/api/types.ts'

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
export async function getNotifications(signal?: AbortSignal): Promise<Notifications> {
  // 백엔드가 회원별 최신 20개만 보관합니다.
  return (await http.get<ApiResponse<Notifications>>('/api/v1/notifications', { params: { page: 1, size: 20 }, signal })).data.data
}
export async function deleteNotification(id: string): Promise<void> {
  await ensureCsrfToken()
  await http.delete(`/api/v1/notifications/${encodeURIComponent(id)}`)
}
