import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import { useGeneration } from '../../guidebook/model/generation.ts'
import { getMemberSettings } from '../../member/api/memberSettings.ts'
import {
  closeNotificationStream,
  deleteNotification,
  getNotifications,
  openNotificationStream,
  parseNotificationEvent,
  type Notification,
} from '../api/notifications.ts'
import {
  notifyNotificationsUpdated,
  REALTIME_NOTIFICATION_SETTING_CHANGED_EVENT,
  type RealtimeNotificationSettingChangedDetail,
} from '../model/events.ts'
import { restoreWebPushSubscription } from '../model/webPush.ts'
import {
  markServiceWorkerNotificationSeen,
  parseWebPushReceivedMessage,
} from '../model/webPushMessages.ts'

const NOTIFICATION_EVENT_NAME = 'notification'
const CONNECTED_EVENT_NAME = 'connected'

type GuidebookNavigationState = {
  highlightGuidebookId: number
}

function guidebookId(notification: Notification): number | null {
  if (notification.reference_type !== 'GUIDEBOOK') return null
  const value = Number(notification.reference_id)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function notificationToastMessage(notification: Notification): string {
  if (notification.type !== 'GUIDEBOOK_COMPLETED') {
    return `${notification.title} ${notification.body}`
  }

  const quotedGuidebookTitle = notification.body.match(/'([^']+)'/)?.[1]?.trim()
  const destinationName = quotedGuidebookTitle
    ?.replace(/\s*여행\s*가이드북$/, '')
    .replace(/\s*가이드북$/, '')
    .trim()

  return destinationName
    ? `${destinationName} 여행 가이드북 생성 완료!`
    : '여행 가이드북 생성 완료!'
}

export function NotificationCenter() {
  const navigate = useNavigate()
  const { member, job } = useGeneration()
  const [realtimeEnabled, setRealtimeEnabled] = useState<boolean | null>(null)
  const [pendingNotifications, setPendingNotifications] = useState<Notification[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actingNotificationId, setActingNotificationId] = useState<string | null>(null)
  const seenNotificationIds = useRef(new Set<string>())
  const settingsRequestRevision = useRef(0)
  const completedId = job?.status === 'COMPLETED' ? job.guidebook_id : null
  const currentNotification = pendingNotifications[0] ?? null

  const syncNotifications = useCallback(async (signal?: AbortSignal) => {
    const next = await getNotifications(signal)
    if (!signal?.aborted) notifyNotificationsUpdated(next.unread_count)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const serviceWorker = navigator.serviceWorker
    const handleWebPushMessage = (event: MessageEvent<unknown>) => {
      const message = parseWebPushReceivedMessage(event.data)
      if (!message) return
      seenNotificationIds.current.add(message.notificationId)
      setPendingNotifications((current) => current.filter(
        ({ notification_id: notificationId }) => notificationId !== message.notificationId,
      ))
      void syncNotifications().catch(() => undefined)
    }
    serviceWorker.addEventListener('message', handleWebPushMessage)
    return () => serviceWorker.removeEventListener('message', handleWebPushMessage)
  }, [syncNotifications])

  useEffect(() => {
    const handleSettingChanged = (event: Event) => {
      const { enabled } = (event as CustomEvent<RealtimeNotificationSettingChangedDetail>).detail
      settingsRequestRevision.current += 1
      setRealtimeEnabled(enabled)
      if (!enabled) closeNotificationStream()
    }
    window.addEventListener(
      REALTIME_NOTIFICATION_SETTING_CHANGED_EVENT,
      handleSettingChanged,
    )
    return () => window.removeEventListener(
      REALTIME_NOTIFICATION_SETTING_CHANGED_EVENT,
      handleSettingChanged,
    )
  }, [])

  useEffect(() => {
    seenNotificationIds.current.clear()
    // 회원 경계가 바뀌면 이전 회원의 토스트·수신 설정을 즉시 폐기합니다.
    // oxlint-disable-next-line react/set-state-in-effect
    setPendingNotifications([])
    setFeedback(null)
    setRealtimeEnabled(null)
    const revision = settingsRequestRevision.current + 1
    settingsRequestRevision.current = revision

    if (member?.status !== 'ACTIVE') {
      closeNotificationStream()
      return undefined
    }

    const controller = new AbortController()
    void getMemberSettings(controller.signal).then((settings) => {
      if (!controller.signal.aborted && settingsRequestRevision.current === revision) {
        setRealtimeEnabled(settings.push_enabled)
        if (settings.push_enabled) {
          // 이미 허용된 브라우저만 현재 회원으로 재등록하며 권한 창은 자동으로 열지 않습니다.
          void restoreWebPushSubscription().catch(() => undefined)
        }
      }
    }).catch(() => {
      if (!controller.signal.aborted && settingsRequestRevision.current === revision) {
        // 수신 설정을 확인하지 못한 상태에서 실시간 연결을 임의로 열지 않습니다.
        setRealtimeEnabled(false)
      }
    })
    return () => controller.abort()
  }, [member?.member_id, member?.status])

  useEffect(() => {
    if (member?.status !== 'ACTIVE' || realtimeEnabled !== true) return undefined

    const controller = new AbortController()
    const stream = openNotificationStream()
    const handleConnected = () => {
      // connected는 사용자 알림이 아니며, 재연결 중 누락된 DB 알림만 복구합니다.
      void syncNotifications(controller.signal).catch(() => undefined)
    }
    const handleNotification = (event: Event) => {
      const notification = parseNotificationEvent((event as MessageEvent<string>).data)
      if (!notification || seenNotificationIds.current.has(notification.notification_id)) return
      seenNotificationIds.current.add(notification.notification_id)
      markServiceWorkerNotificationSeen(notification.notification_id)
      setPendingNotifications((current) => [...current, notification])
      void syncNotifications(controller.signal).catch(() => undefined)
    }

    stream.addEventListener(CONNECTED_EVENT_NAME, handleConnected)
    stream.addEventListener(NOTIFICATION_EVENT_NAME, handleNotification)
    return () => {
      controller.abort()
      stream.removeEventListener(CONNECTED_EVENT_NAME, handleConnected)
      stream.removeEventListener(NOTIFICATION_EVENT_NAME, handleNotification)
      closeNotificationStream(stream)
    }
  }, [member?.member_id, member?.status, realtimeEnabled, syncNotifications])

  useEffect(() => {
    if (member?.status !== 'ACTIVE' || !completedId) return undefined
    const controller = new AbortController()
    // 실시간 수신을 꺼 둔 회원도 생성 상태 폴링 완료 시 배지는 목록 기준으로 복구합니다.
    void syncNotifications(controller.signal).catch(() => undefined)
    return () => controller.abort()
  }, [member?.member_id, member?.status, completedId, syncNotifications])

  const dismissCurrentNotification = useCallback(() => {
    setPendingNotifications((current) => current.slice(1))
  }, [])

  const openCurrentGuidebook = async () => {
    if (!currentNotification || actingNotificationId) return
    const targetGuidebookId = guidebookId(currentNotification)
    if (!targetGuidebookId) return

    setActingNotificationId(currentNotification.notification_id)
    try {
      await deleteNotification(currentNotification.notification_id)
      dismissCurrentNotification()
      void syncNotifications().catch(() => undefined)
      navigate(routes.guidebooks, {
        state: { highlightGuidebookId: targetGuidebookId } satisfies GuidebookNavigationState,
      })
    } catch {
      setFeedback('읽음 처리에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setActingNotificationId(null)
    }
  }

  if (feedback) {
    return <Toast key="notification-feedback" message={feedback} onDismiss={() => setFeedback(null)} />
  }

  if (!currentNotification) return null
  const targetGuidebookId = guidebookId(currentNotification)
  const toastMessage = notificationToastMessage(currentNotification)

  return (
    <Toast
      key={currentNotification.notification_id}
      message={toastMessage}
      duration={5000}
      onDismiss={dismissCurrentNotification}
      onAction={targetGuidebookId ? () => void openCurrentGuidebook() : undefined}
      actionLabel={targetGuidebookId ? '가이드북 보기' : undefined}
      actionDisabled={actingNotificationId === currentNotification.notification_id}
    />
  )
}
