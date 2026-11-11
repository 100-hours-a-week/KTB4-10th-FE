import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { deleteBook, listBooks, type BookList, type Book } from '../api/guidebooks.ts'
import { companions, message } from '../model/conditions.ts'
import { isRunning, useGeneration } from '../model/generation.ts'
import { BookCover, State } from './GuidebookLayout.tsx'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { getCreditWallet } from '../api/credits.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import { routes } from '../../../shared/config/routes.ts'
import { getCurrentMember } from '../../auth/api/auth.ts'
import {
  NOTIFICATIONS_UPDATED_EVENT,
  type NotificationsUpdatedDetail,
} from '../../notification/model/events.ts'

const HIGHLIGHT_DURATION_MS = 600
const SCROLL_END_FALLBACK_MS = 800

function isFullyVisible(element: HTMLElement): boolean {
  const { top, bottom } = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  return top >= 0 && bottom <= viewportHeight
}

export function GuidebookListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { job, error: jobError, refresh, dismiss } = useGeneration()
  const [data, setData] = useState<BookList | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [target, setTarget] = useState<Book | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const modal = useRef<HTMLDialogElement>(null)
  const creditModal = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const loadLock = useRef(false)
  const deleteLock = useRef(false)
  const failedCursor = useRef<string | undefined>(undefined)
  const completedId = job?.status === 'COMPLETED' ? job.guidebook_id : null
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const cardElements = useRef(new Map<number, HTMLLIElement>())
  const automaticCursors = useRef(new Set<string>())
  const automaticTarget = useRef(0)
  const [highlightError, setHighlightError] = useState('')
  const [highlightedGuidebookId, setHighlightedGuidebookId] = useState<number | null>(null)
  const stateHighlightId = (location.state as { highlightGuidebookId?: unknown } | null)
    ?.highlightGuidebookId
  const requestedHighlightId = Number(
    stateHighlightId ?? new URLSearchParams(location.search).get('highlightGuidebookId'),
  )

  useEffect(() => {
    const controller = new AbortController()
    void getCreditWallet(controller.signal)
      .then((wallet) => { if (!controller.signal.aborted) setCreditBalance(wallet.credit_balance) })
      .catch(() => { if (!controller.signal.aborted) setCreditBalance(null) })
    return () => controller.abort()
  }, [completedId])

  useEffect(() => {
    let active = true
    void getCurrentMember()
      .then((member) => { if (active) setUnreadCount(member.unread_count) })
      .catch(() => undefined)

    const handleNotificationsUpdated = (event: Event) => {
      const { unreadCount: nextUnreadCount } = (
        event as CustomEvent<NotificationsUpdatedDetail>
      ).detail
      setUnreadCount(nextUnreadCount)
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated)
    return () => {
      active = false
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated)
    }
  }, [])

  useEffect(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    loadLock.current = true
    void listBooks(undefined, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setData(next); setError('') }
    }).catch((reason) => { if (!controller.signal.aborted) { failedCursor.current = undefined; setError(message(reason)) } })
      .finally(() => { if (!controller.signal.aborted) { loadLock.current = false; setLoading(false) } })
    return () => { request.current?.abort() }
  }, [revision, completedId])

  useEffect(() => {
    if (target) modal.current?.showModal()
    else modal.current?.close()
  }, [target])

  const loadMore = useCallback(async () => {
    if (!data?.next_cursor || loadLock.current) return
    const cursor = data.next_cursor
    const controller = new AbortController()
    request.current = controller; loadLock.current = true; setLoading(true); setError('')
    try {
      const next = await listBooks(cursor, controller.signal)
      if (!controller.signal.aborted) setData((current) => ({
        ...next, items: [...(current?.items ?? []), ...next.items.filter((item) => !current?.items.some((old) => old.guidebook_id === item.guidebook_id))],
      }))
    } catch (reason) { if (!controller.signal.aborted) { failedCursor.current = cursor; setError(message(reason)) } }
    finally { if (!controller.signal.aborted) { loadLock.current = false; setLoading(false) } }
  }, [data])

  useEffect(() => {
    if (!Number.isSafeInteger(requestedHighlightId) || requestedHighlightId < 1) return undefined
    if (automaticTarget.current !== requestedHighlightId) {
      automaticTarget.current = requestedHighlightId
      automaticCursors.current.clear()
    }
    if (!data) return undefined
    if (!data.items.some(({ guidebook_id }) => guidebook_id === requestedHighlightId)) {
      if (data.has_more && data.next_cursor && !loading && !automaticCursors.current.has(data.next_cursor)) {
        automaticCursors.current.add(data.next_cursor)
        void loadMore()
      } else if (!data.has_more && !loading) {
        const timer = window.setTimeout(() => {
          setHighlightError('대상 가이드북을 찾지 못했습니다.')
          const query = new URLSearchParams(location.search)
          query.delete('highlightGuidebookId')
          navigate({
            pathname: location.pathname,
            search: query.size > 0 ? `?${query.toString()}` : '',
          }, { replace: true, state: null })
        }, 0)
        return () => window.clearTimeout(timer)
      }
      return undefined
    }

    const targetElement = cardElements.current.get(requestedHighlightId)
    if (!targetElement) return undefined

    let highlightStarted = false
    let scrollFallbackTimer: number | undefined
    let highlightTimer: number | undefined
    const clearHighlightTarget = () => {
      const query = new URLSearchParams(location.search)
      query.delete('highlightGuidebookId')
      navigate({
        pathname: location.pathname,
        search: query.size > 0 ? `?${query.toString()}` : '',
      }, { replace: true, state: null })
    }
    const startHighlight = () => {
      if (highlightStarted) return
      highlightStarted = true
      window.removeEventListener('scrollend', startHighlight)
      if (scrollFallbackTimer !== undefined) window.clearTimeout(scrollFallbackTimer)
      setHighlightedGuidebookId(requestedHighlightId)
      highlightTimer = window.setTimeout(() => {
        setHighlightedGuidebookId(null)
        clearHighlightTarget()
      }, HIGHLIGHT_DURATION_MS)
    }

    targetElement.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    })
    if (isFullyVisible(targetElement)) {
      scrollFallbackTimer = window.setTimeout(startHighlight, 0)
    } else {
      window.addEventListener('scrollend', startHighlight, { once: true })
      scrollFallbackTimer = window.setTimeout(startHighlight, SCROLL_END_FALLBACK_MS)
    }
    return () => {
      window.removeEventListener('scrollend', startHighlight)
      if (scrollFallbackTimer !== undefined) window.clearTimeout(scrollFallbackTimer)
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer)
    }
  }, [data, loadMore, loading, location.pathname, location.search, navigate, requestedHighlightId])

  async function remove() {
    if (!target || deleteLock.current) return
    deleteLock.current = true; setDeleting(true); setDeleteError('')
    try {
      await deleteBook(target.guidebook_id)
      if (job?.guidebook_id === target.guidebook_id) dismiss()
      setTarget(null); setRevision((value) => value + 1)
    } catch (reason) { setDeleteError(message(reason)) }
    finally { deleteLock.current = false; setDeleting(false) }
  }

  function openCreate() {
    if (creditBalance === 0) {
      creditModal.current?.showModal()
      return
    }
    navigate(routes.guidebookCreate)
  }

  return <main className="app-shell book-page book-list-page">
    <PageHeader title="가이드북">
      <button
        className="app-page-header__notification"
        type="button"
        aria-label={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개 확인` : '알림 확인'}
        onClick={() => navigate(routes.notifications, { state: { returnTo: routes.guidebooks } })}
      >
        <img
          src={unreadCount > 0
            ? '/assets/mypage/bell-unread.png'
            : '/assets/mypage/bell-empty.png'}
          alt=""
          aria-hidden="true"
        />
        {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>
    </PageHeader>
    <div className="book-content">
      <button className="book-create-card" type="button" onClick={openCreate} aria-label="새 가이드북 만들기">
        <span className="book-create-card__plus" aria-hidden="true">
          <img src="/assets/map-controls/add.png" alt="" />
        </span>
        <span className="book-create-card__copy">
          <strong>새 가이드북 만들기</strong>
          <small>{creditBalance === null ? '생성권 확인 중' : `생성권 ${creditBalance}개 남음`}</small>
        </span>
        <img className="book-create-card__arrow" src="/assets/guidebook/down-arrow.png" alt="" aria-hidden="true" />
      </button>
      {job && job.status !== 'COMPLETED' && <div className={`book-job${job.status === 'FAILED' ? ' book-job--dismissible' : ''}`}>
        <Link className="book-job-link" to={`/guidebooks/generating/${job.job_id}`} aria-label={`${isRunning(job) ? '가이드북을 만들고 있어요' : job.status === 'FAILED' ? '가이드북 생성에 실패했어요' : '생성이 취소되었어요'} 상세 확인`}>
          <strong className="book-job-message">{isRunning(job) ? '가이드북을 만들고 있어요' : job.status === 'FAILED' ? '가이드북 생성에 실패했어요' : '생성이 취소되었어요'}</strong>
          {job.status !== 'FAILED' && <img src="/assets/guidebook/down-arrow.png" alt="" aria-hidden="true" />}
        </Link>
        {job.status === 'FAILED' && <button className="book-job-dismiss" type="button" onClick={dismiss} aria-label="생성 실패 안내 닫기">×</button>}
      </div>}
      {jobError && <State error onRetry={job ? refresh : undefined}>{jobError}</State>}
      {error && <State error onRetry={() => failedCursor.current ? void loadMore() : setRevision((value) => value + 1)}>{error}</State>}
      {data?.items.length === 0 && !loading && !error && <div className="book-empty"><BookCover /><h2>아직 가이드북이 없어요</h2><p>여행할 곳을 고르고<br />나만의 여행을 만들어 보세요.</p></div>}
      <ul className="book-list">{data?.items.map((book) => <li
        className={`book-card${highlightedGuidebookId === book.guidebook_id ? ' book-card--highlighted' : ''}`}
        key={book.guidebook_id}
        ref={(element) => {
          if (element) cardElements.current.set(book.guidebook_id, element)
          else cardElements.current.delete(book.guidebook_id)
        }}
      >
        <Link to={`/guidebooks/${book.guidebook_id}/viewer`} className="book-card-main"><BookCover thumbnailUrl={book.thumbnail_url} /><div><h2>{book.title}</h2><p>{book.start_date.replaceAll('-', '.')} – {book.end_date.replaceAll('-', '.')}</p><span>{companions[book.companion]?.[0]}</span></div></Link>
        <a
          className="book-pdf"
          href={`/guidebooks/${book.guidebook_id}/print`}
          target="_blank"
          rel="noopener"
          aria-label={`${book.title} PDF 저장`}
        >
          <img src="/assets/guidebook/paper.png" alt="" aria-hidden="true" />
        </a>
        <button className="book-delete" onClick={() => { setDeleteError(''); setTarget(book) }} aria-label={`${book.title} 삭제`}>
          <img src="/assets/guidebook/bin.png" alt="" aria-hidden="true" />
        </button>
      </li>)}</ul>
      {loading && <State>가이드북을 불러오고 있어요.</State>}
      {data?.has_more && !loading && <button className="secondary-button book-more" onClick={() => void loadMore()}>더 보기</button>}
    </div>
    <BottomNavigation />
    <dialog ref={modal} className="book-dialog" onCancel={(event) => { if (deleting) event.preventDefault(); else setTarget(null) }}>
      <h2>삭제하시겠습니까?</h2><p>내 목록에서 가이드북이 삭제돼요.</p>
      {deleteError && <p role="alert" className="book-error">{deleteError}</p>}
      <div className="book-dialog-actions"><button className="secondary-button" disabled={deleting} onClick={() => setTarget(null)}>취소</button><button className="primary-button" disabled={deleting} onClick={() => void remove()}>{deleting ? '삭제 중…' : '삭제'}</button></div>
    </dialog>
    <dialog ref={creditModal} className="book-dialog">
      <h2>생성권이 부족해요</h2>
      <p>가이드북을 만들려면 생성권이 필요해요.</p>
      <div className="book-dialog-actions">
        <button className="secondary-button" type="button" onClick={() => creditModal.current?.close()}>닫기</button>
        <button className="primary-button" type="button" onClick={() => navigate(routes.coupon)}>쿠폰 등록</button>
      </div>
    </dialog>
    {highlightError && <Toast message={highlightError} onDismiss={() => setHighlightError('')} />}
  </main>
}
