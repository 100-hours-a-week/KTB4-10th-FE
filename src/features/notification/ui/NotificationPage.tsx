import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import {
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  type Notification,
} from '../api/notifications.ts'
import {
  notifyNotificationsUpdated,
  NOTIFICATIONS_UPDATED_EVENT,
} from '../model/events.ts'
import { guidebookNotificationDestination } from '../model/guidebookNotificationNavigation.ts'
import './notification-page.css'

const SWIPE_LIMIT = 88
const SWIPE_DELETE_THRESHOLD = 56
const REMOVE_ANIMATION_MS = 180

type NotificationLocationState = {
  returnTo?: string
}

function notificationReturnTo(state: unknown): string {
  const returnTo = (state as NotificationLocationState | null)?.returnTo
  if (returnTo === routes.myPage || returnTo === routes.information) return returnTo
  if (returnTo?.startsWith(`${routes.information}?`)) return returnTo
  return routes.myPage
}

function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function newestFirst(items: Notification[]): Notification[] {
  return [...items].sort((left, right) => {
    const createdDifference = Date.parse(right.created_at) - Date.parse(left.created_at)
    if (createdDifference !== 0) return createdDifference
    return Number(right.notification_id) - Number(left.notification_id)
  })
}

function NotificationListSkeleton() {
  return (
    <div role="status" aria-label="알림 목록 불러오는 중">
      <ul className="notification-list notification-list--skeleton" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <li className="notification-card notification-card--skeleton" key={index}>
            <article className="notification-card__content">
              <div>
                <span className="notification-skeleton__block notification-skeleton__title" />
                <span className="notification-skeleton__block notification-skeleton__time" />
              </div>
              <span className="notification-skeleton__block notification-skeleton__body" />
              <span className="notification-skeleton__block notification-skeleton__hint" />
            </article>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NotificationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = notificationReturnTo(location.state)
  const [items, setItems] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [dragOffsets, setDragOffsets] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<string | null>(null)
  const dragStart = useRef<{ id: string; x: number } | null>(null)
  const suppressClickId = useRef<string | null>(null)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await getNotifications()
      setItems(newestFirst(response.items))
    } catch {
      setLoadError('알림을 불러오지 못했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // 페이지 진입 시 회원에게 저장된 최신 인앱 알림을 조회합니다.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const handleNotificationsUpdated = () => { void loadNotifications() }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated)
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated)
  }, [loadNotifications])

  const isMutating = deletingId !== null || isDeletingAll
  const visibleItems = useMemo(() => newestFirst(items), [items])

  const removeFromList = (ids: string[]) => {
    setRemovingIds((current) => new Set([...current, ...ids]))
    window.setTimeout(() => {
      setItems((current) => current.filter(({ notification_id }) => !ids.includes(notification_id)))
      setRemovingIds((current) => {
        const next = new Set(current)
        ids.forEach((id) => next.delete(id))
        return next
      })
      setDragOffsets((current) => {
        const next = { ...current }
        ids.forEach((id) => delete next[id])
        return next
      })
    }, REMOVE_ANIMATION_MS)
  }

  const handleDelete = async (notificationId: string) => {
    if (isMutating) return
    setDeletingId(notificationId)
    try {
      await deleteNotification(notificationId)
      removeFromList([notificationId])
      notifyNotificationsUpdated(Math.max(0, items.length - 1))
    } catch {
      setDragOffsets((current) => ({ ...current, [notificationId]: 0 }))
      setToast('읽음 처리에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenGuidebook = async (notification: Notification) => {
    if (suppressClickId.current === notification.notification_id) {
      suppressClickId.current = null
      return
    }
    const targetGuidebookId = notification.reference_type === 'GUIDEBOOK'
      ? Number(notification.reference_id)
      : Number.NaN
    if (isMutating || !Number.isSafeInteger(targetGuidebookId) || targetGuidebookId < 1) return

    setDeletingId(notification.notification_id)
    try {
      await deleteNotification(notification.notification_id)
      notifyNotificationsUpdated(Math.max(0, items.length - 1))
      const destination = guidebookNotificationDestination(notification.type, targetGuidebookId)
      navigate(destination.pathname, { state: destination.state })
    } catch {
      setToast('읽음 처리에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAll = async () => {
    if (isMutating || items.length === 0) return
    setIsDeletingAll(true)
    try {
      await deleteAllNotifications()
      removeFromList(items.map(({ notification_id }) => notification_id))
    } catch {
      setToast('읽음 처리에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsDeletingAll(false)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>, id: string) => {
    if (isMutating) return
    dragStart.current = { id, x: event.clientX }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>, id: string) => {
    if (dragStart.current?.id !== id) return
    const offset = Math.max(-SWIPE_LIMIT, Math.min(0, event.clientX - dragStart.current.x))
    if (Math.abs(offset) > 8) suppressClickId.current = id
    setDragOffsets((current) => ({ ...current, [id]: offset }))
  }

  const handlePointerEnd = (event: PointerEvent<HTMLElement>, id: string) => {
    if (dragStart.current?.id !== id) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const finalOffset = Math.max(-SWIPE_LIMIT, Math.min(0, event.clientX - dragStart.current.x))
    dragStart.current = null
    if (finalOffset <= -SWIPE_DELETE_THRESHOLD) {
      void handleDelete(id)
      return
    }
    setDragOffsets((current) => ({ ...current, [id]: 0 }))
  }

  return (
    <main className="app-shell notification-page">
      <header className="notification-page__header">
        <button type="button" aria-label="이전 화면으로 돌아가기" onClick={() => navigate(returnTo)}>‹</button>
        <h1>알림</h1>
        <span aria-hidden="true" />
      </header>

      <div className="notification-page__content">
        {isLoading && <NotificationListSkeleton />}

        {!isLoading && loadError && (
          <div className="notification-page__state" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadNotifications()}>다시 불러오기</button>
          </div>
        )}

        {!isLoading && !loadError && visibleItems.length === 0 && (
          <div className="notification-page__empty">
            <img src="/assets/notifications/empty.png" alt="" />
            <p>새로운 알림이 없습니다.</p>
          </div>
        )}

        {!isLoading && !loadError && visibleItems.length > 0 && (
          <ul className="notification-list" aria-label="새로운 알림">
            {visibleItems.map((notification) => (
              <li
                className={`notification-card${removingIds.has(notification.notification_id) ? ' notification-card--removing' : ''}`}
                key={notification.notification_id}
              >
                <button
                  className="notification-card__read-action"
                  type="button"
                  disabled={isMutating}
                  onClick={() => void handleDelete(notification.notification_id)}
                >
                  읽음
                </button>
                <article
                  className="notification-card__content"
                  role={notification.reference_type === 'GUIDEBOOK' ? 'button' : undefined}
                  tabIndex={notification.reference_type === 'GUIDEBOOK' ? 0 : undefined}
                  aria-label={notification.reference_type === 'GUIDEBOOK'
                    ? `${notification.title} 가이드북 보기`
                    : undefined}
                  style={{ transform: `translateX(${dragOffsets[notification.notification_id] ?? 0}px)` }}
                  onClick={() => void handleOpenGuidebook(notification)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void handleOpenGuidebook(notification)
                    }
                  }}
                  onPointerDown={(event) => handlePointerDown(event, notification.notification_id)}
                  onPointerMove={(event) => handlePointerMove(event, notification.notification_id)}
                  onPointerUp={(event) => handlePointerEnd(event, notification.notification_id)}
                  onPointerCancel={(event) => handlePointerEnd(event, notification.notification_id)}
                >
                  <div>
                    <strong>{notification.title}</strong>
                    <time dateTime={notification.created_at}>{formatCreatedAt(notification.created_at)}</time>
                  </div>
                  <p>{notification.body}</p>
                  <small>{notification.reference_type === 'GUIDEBOOK'
                    ? '눌러서 가이드북 보기 · 왼쪽으로 밀어 읽음 처리'
                    : '왼쪽으로 밀어 읽음 처리'}</small>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="notification-page__footer">
        <button
          className="primary-button"
          type="button"
          disabled={isLoading || visibleItems.length === 0 || isMutating}
          onClick={() => void handleDeleteAll()}
        >
          {isDeletingAll ? '읽음 처리 중...' : '모든 알림 읽음 처리'}
        </button>
      </footer>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  )
}
