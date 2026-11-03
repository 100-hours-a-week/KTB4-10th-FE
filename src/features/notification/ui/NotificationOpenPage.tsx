import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { deleteNotification, getNotifications } from '../api/notifications.ts'
import { notifyNotificationsUpdated } from '../model/events.ts'
import {
  EVENT_LIST_REFERENCE_TYPE,
  NEW_EVENTS_ADDED_NOTIFICATION,
  notificationDestination,
  TRIP_STARTING_NOTIFICATION,
} from '../model/notificationNavigation.ts'
import './notification-page.css'

function positiveInteger(value: string | null): number | null {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function NotificationOpenPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState(false)
  const notificationId = searchParams.get('notificationId')
  const notificationType = searchParams.get('type')
  const legacyGuidebookId = positiveInteger(searchParams.get('guidebookId'))
  const effectiveNotificationType = notificationType
    ?? (legacyGuidebookId ? TRIP_STARTING_NOTIFICATION : null)
  const referenceType = searchParams.get('referenceType')
    ?? (legacyGuidebookId ? 'GUIDEBOOK' : null)
  const referenceId = searchParams.get('referenceId') ?? legacyGuidebookId
  const destination = useMemo(() => (
    referenceId !== null
      ? notificationDestination(effectiveNotificationType, referenceType, referenceId, {
          eventReturnTo: routes.notifications,
        })
      : null
  ), [effectiveNotificationType, referenceId, referenceType])

  useEffect(() => {
    if (!notificationId || !destination) {
      const isInvalidNewEventTarget = (
        effectiveNotificationType === NEW_EVENTS_ADDED_NOTIFICATION ||
        referenceType === EVENT_LIST_REFERENCE_TYPE
      )
      navigate(isInvalidNewEventTarget ? routes.information : routes.notifications, {
        replace: true,
      })
      return undefined
    }

    let active = true
    void deleteNotification(notificationId)
      .catch((reason: unknown) => {
        // 이미 읽은 알림은 목적을 달성한 상태이므로 대상 이동을 계속합니다.
        if (!axios.isAxiosError(reason) || reason.response?.status !== 404) throw reason
      })
      .then(() => {
        if (!active) return
        void getNotifications()
          .then(({ unread_count: unreadCount }) => notifyNotificationsUpdated(unreadCount))
          .catch(() => undefined)
        navigate(destination.pathname, {
          replace: true,
          state: destination.state,
        })
      })
      .catch(() => { if (active) setError(true) })

    return () => { active = false }
  }, [destination, effectiveNotificationType, navigate, notificationId, referenceType, revision])

  return (
    <main className="app-shell notification-open-page">
      <div className="notification-page__state" role={error ? 'alert' : 'status'}>
        {error ? (
          <>
            <p>알림을 읽음 처리하지 못했습니다.</p>
            <button type="button" onClick={() => {
              setError(false)
              setRevision((current) => current + 1)
            }}>
              다시 시도
            </button>
            <button type="button" onClick={() => navigate(routes.notifications, { replace: true })}>
              알림 목록으로
            </button>
          </>
        ) : (
          <>
            <img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" />
            {referenceType === 'EVENT_LIST'
              ? '신규 행사를 여는 중이에요.'
              : referenceType === 'EVENT'
                ? '행사를 여는 중이에요.'
                : '가이드북을 여는 중이에요.'}
          </>
        )}
      </div>
    </main>
  )
}
