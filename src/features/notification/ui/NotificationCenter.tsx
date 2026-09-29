import { useEffect, useRef, useState } from 'react'
import { useGeneration } from '../../guidebook/model/generation.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import { getNotifications } from '../api/notifications.ts'
import { notifyNotificationsUpdated } from '../model/events.ts'

export function NotificationCenter() {
  const { member, job } = useGeneration()
  const [toast, setToast] = useState('')
  const announced = useRef<string | null>(null)
  const completedId = job?.status === 'COMPLETED' ? job.guidebook_id : null

  useEffect(() => {
    if (member?.status !== 'ACTIVE' || !completedId) return
    const controller = new AbortController()
    void getNotifications(controller.signal).then((next) => {
      if (controller.signal.aborted) return
      notifyNotificationsUpdated(next.unread_count)
      const notification = next.items.find((item) => (
        item.type === 'GUIDEBOOK_COMPLETED' && item.reference_id === String(completedId)
      ))
      if (notification && announced.current !== notification.notification_id) {
        announced.current = notification.notification_id
        setToast(notification.title)
      }
    }).catch(() => {
      // 생성 결과 화면은 유지하고 알림 페이지에서 다시 조회할 수 있게 둡니다.
    })
    return () => controller.abort()
  }, [member?.member_id, member?.status, completedId])

  return toast
    ? <Toast message={toast} onDismiss={() => setToast('')} duration={3000} />
    : null
}
