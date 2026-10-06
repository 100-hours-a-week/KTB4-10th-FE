import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { deleteBook, listBooks, type BookList, type Book } from '../api/guidebooks.ts'
import { companions, message } from '../model/conditions.ts'
import { isRunning, useGeneration } from '../model/generation.ts'
import { BookCover, State } from './GuidebookLayout.tsx'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { getCreditWallet } from '../api/credits.ts'

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
  const request = useRef<AbortController | null>(null)
  const loadLock = useRef(false)
  const deleteLock = useRef(false)
  const failedCursor = useRef<string | undefined>(undefined)
  const completedId = job?.status === 'COMPLETED' ? job.guidebook_id : null
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const cardElements = useRef(new Map<number, HTMLLIElement>())
  const requestedHighlightId = Number(
    (location.state as { highlightGuidebookId?: unknown } | null)?.highlightGuidebookId,
  )

  useEffect(() => {
    const controller = new AbortController()
    void getCreditWallet(controller.signal)
      .then((wallet) => { if (!controller.signal.aborted) setCreditBalance(wallet.credit_balance) })
      .catch(() => { if (!controller.signal.aborted) setCreditBalance(null) })
    return () => controller.abort()
  }, [completedId])

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

  useEffect(() => {
    if (!Number.isSafeInteger(requestedHighlightId) || requestedHighlightId < 1) return undefined
    if (!data?.items.some(({ guidebook_id }) => guidebook_id === requestedHighlightId)) return undefined

    cardElements.current.get(requestedHighlightId)?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    })
    const timer = window.setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null })
    }, 320)
    return () => window.clearTimeout(timer)
  }, [data?.items, location.pathname, navigate, requestedHighlightId])

  async function more() {
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
  }

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

  return <main className="app-shell book-page book-list-page">
    <PageHeader title="가이드북" leading={<span className="book-credit-balance" role="status" aria-label="잔여 생성권">잔여 생성권<br /><strong>{creditBalance === null ? '—' : `${creditBalance}개`}</strong></span>}>
      <Link className="book-create-link" to="/guidebooks/new" aria-label="가이드북 만들기">생성</Link>
    </PageHeader>
    <div className="book-content">
      {job && job.status !== 'COMPLETED' && <Link className="book-job" to={`/guidebooks/generating/${job.job_id}`}>
        <strong>{isRunning(job) ? '가이드북을 만들고 있어요' : job.status === 'FAILED' ? '가이드북 생성에 실패했어요' : '생성이 취소되었어요'}</strong>
        <span>{job.status === 'FAILED' ? '다시 시도하기' : '진행 상황 확인'} ›</span>
      </Link>}
      {jobError && <State error onRetry={job ? refresh : undefined}>{jobError}</State>}
      {error && <State error onRetry={() => failedCursor.current ? void more() : setRevision((value) => value + 1)}>{error}</State>}
      {data?.items.length === 0 && !loading && !error && <div className="book-empty"><BookCover /><h2>아직 가이드북이 없어요</h2><p>여행할 곳을 고르고<br />나만의 여행을 만들어 보세요.</p><Link className="primary-button book-button" to="/guidebooks/new">가이드북 만들기</Link></div>}
      <ul className="book-list">{data?.items.map((book) => <li
        className={`book-card${requestedHighlightId === book.guidebook_id ? ' book-card--highlighted' : ''}`}
        key={book.guidebook_id}
        ref={(element) => {
          if (element) cardElements.current.set(book.guidebook_id, element)
          else cardElements.current.delete(book.guidebook_id)
        }}
      >
        <Link to={`/guidebooks/${book.guidebook_id}/viewer`} className="book-card-main"><BookCover /><div><h2>{book.title}</h2><p>{book.start_date.replaceAll('-', '.')} – {book.end_date.replaceAll('-', '.')}</p><span>{companions[book.companion]?.[0]}</span></div></Link>
        <button className="book-delete" onClick={() => { setDeleteError(''); setTarget(book) }} aria-label={`${book.title} 삭제`}>삭제</button>
      </li>)}</ul>
      {loading && <State>가이드북을 불러오고 있어요.</State>}
      {data?.has_more && !loading && <button className="secondary-button book-more" onClick={() => void more()}>더 보기</button>}
    </div>
    <BottomNavigation />
    <dialog ref={modal} className="book-dialog" onCancel={(event) => { if (deleting) event.preventDefault(); else setTarget(null) }}>
      <h2>삭제하시겠습니까?</h2><p>내 목록에서 가이드북이 삭제돼요.</p>
      {deleteError && <p role="alert" className="book-error">{deleteError}</p>}
      <div className="book-dialog-actions"><button className="secondary-button" disabled={deleting} onClick={() => setTarget(null)}>취소</button><button className="primary-button" disabled={deleting} onClick={() => void remove()}>{deleting ? '삭제 중…' : '삭제'}</button></div>
    </dialog>
  </main>
}
