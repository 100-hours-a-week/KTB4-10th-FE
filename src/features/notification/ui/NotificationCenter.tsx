import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGeneration } from '../../guidebook/model/generation.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import { deleteNotification, getNotifications, type Notifications } from '../api/notifications.ts'

export function NotificationCenter() {
  const { member } = useGeneration()
  const { pathname } = useLocation()
  const enabled = member?.status === 'ACTIVE'
    && pathname !== '/'
    && !pathname.startsWith('/auth')
    && pathname !== '/preferences'
    && !pathname.startsWith('/mypage')
  return enabled ? <MemberNotifications key={member.member_id} /> : null
}

function MemberNotifications() {
  const { member, job } = useGeneration()
  const { pathname } = useLocation()
  const [data, setData] = useState<Notifications | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const announced = useRef<string | null>(null)
  const deleteLock = useRef(false)
  const completedId = job?.status === 'COMPLETED' ? job.guidebook_id : null
  useEffect(() => { dialog.current?.close() }, [pathname])
  useEffect(() => {
    const controller = new AbortController()
    void getNotifications(controller.signal).then((next) => {
      if (controller.signal.aborted) return
      setData(next); setError('')
      const notification = completedId && next.items.find((item) => item.type === 'GUIDEBOOK_COMPLETED' && item.reference_id === String(completedId))
      if (notification && announced.current !== notification.notification_id) {
        announced.current = notification.notification_id
        setToast(notification.title)
      }
    }).catch(() => { if (!controller.signal.aborted) setError('알림을 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [member?.member_id, completedId, revision])
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  async function remove(id: string) {
    if (deleteLock.current) return
    deleteLock.current = true; setDeleting(id); setError('')
    try { await deleteNotification(id); setRevision((value) => value + 1) }
    catch { setError('알림을 삭제하지 못했어요.') }
    finally { deleteLock.current = false; setDeleting(null) }
  }
  return <>
    <button className="notification-bell" aria-label={`알림 ${data?.unread_count ?? member?.unread_count ?? 0}개`} onClick={() => { setOpen(true); setRevision((value) => value + 1) }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 20h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      {(data?.unread_count ?? member?.unread_count ?? 0) > 0 && <span>{data?.unread_count ?? member?.unread_count}</span>}
    </button>
    <dialog className="notification-dialog" ref={dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header><h2>알림</h2><button onClick={() => setOpen(false)} aria-label="알림 닫기">×</button></header>
      {error && <div role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRevision((value) => value + 1)}>다시 확인</button></div>}
      {loading && <p role="status">알림을 불러오는 중…</p>}
      {!loading && !error && data?.items.length === 0 && <p className="notification-empty">새로운 알림이 없어요.</p>}
      <ul>{data?.items.map((item) => <li key={item.notification_id}>
        {item.reference_type === 'GUIDEBOOK' && /^[1-9]\d*$/.test(item.reference_id)
          ? <Link to={`/guidebooks/${item.reference_id}`} onClick={() => setOpen(false)}><strong>{item.title}</strong><p>{item.body}</p></Link>
          : <div><strong>{item.title}</strong><p>{item.body}</p></div>}
        <button className="book-text-button" disabled={deleting !== null} onClick={() => void remove(item.notification_id)} aria-label={`${item.title} 알림 삭제`}>{deleting === item.notification_id ? '삭제 중…' : '삭제'}</button>
      </li>)}</ul>
    </dialog>
    {toast && <Toast message={toast} onDismiss={() => setToast('')} duration={3000} />}
  </>
}
