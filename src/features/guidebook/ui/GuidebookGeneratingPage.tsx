import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGeneration } from '../model/generation.ts'
import { BookHeader, State } from './GuidebookLayout.tsx'

export function GuidebookGeneratingPage() {
  const { jobId } = useParams()
  const id = Number(jobId)
  const { job, track, error, retry, refresh, busy, dismiss } = useGeneration()
  const navigate = useNavigate()
  const guidebookConfirmDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (Number.isSafeInteger(id) && id > 0 && !job && !error) track({ job_id: id, status: 'PENDING', guidebook_id: null })
  }, [id, job, track, error])
  useEffect(() => {
    if (job?.job_id === id && job.status === 'COMPLETED' && job.guidebook_id) navigate(`/guidebooks/${job.guidebook_id}`, { replace: true })
  }, [job, id, navigate])
  if (!Number.isSafeInteger(id) || id < 1) return <main className="app-shell"><BookHeader title="가이드북" /><State error>잘못된 생성 작업 주소예요.</State></main>
  if (!job && error) return <main className="app-shell"><BookHeader title="가이드북" /><State error>{error}</State></main>
  if (job && job.job_id !== id) return <main className="app-shell"><BookHeader title="가이드북" /><State>다른 생성 작업을 확인 중이에요.<Link to={`/guidebooks/generating/${job.job_id}`}>진행 상황 보기</Link></State></main>
  const failed = job?.status === 'FAILED'
  const canceled = job?.status === 'CANCELED'
  const remainingRetries = Math.max(0, 3 - (job?.attempt_count ?? 0))
  const canRetry = failed && job?.error?.retryable !== false && remainingRetries > 0
  const canModifyFeedback = failed && job?.error?.code === 'feedback_not_applicable' && job.guidebook_id !== null
  const isRegenerationFailure = failed && job?.job_type === 'REGENERATION' && job.guidebook_id !== null
  const failureMessage = job?.error?.message ?? '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  const generating = !error && !failed && !canceled && job?.status !== 'COMPLETED'
  function confirmGuidebook() {
    const guidebookId = job?.guidebook_id
    if (!guidebookId) return
    guidebookConfirmDialog.current?.close()
    dismiss()
    navigate(`/guidebooks/${guidebookId}`)
  }
  return <main className="app-shell book-page">
    <BookHeader title={failed ? '가이드북 생성 실패' : canceled ? '가이드북 생성 취소' : '가이드북 생성 중'} />
    <section className="book-generation" aria-live="polite">
      {failed || canceled || error
        ? <div className="book-spark" aria-hidden="true">!</div>
        : <img className="loading-indicator book-generation__indicator" src="/assets/loading-indicator.svg" alt="" />}
      <h2>{failed ? '가이드북을 만들지 못했어요' : canceled ? '생성이 취소되었어요' : '가이드북을 만들고 있어요'}</h2>
      <p>{failed ? failureMessage : canceled ? '새 여행 조건으로 다시 시작할 수 있어요.' : '취향에 맞는 여행을 한 권에 담고 있어요.\n완성되면 알림으로 알려드릴게요.'}</p>
      {generating && <p className="book-generation-background">다른 화면을 이용해도 생성은 계속돼요.</p>}
      {error && <p className="book-error" role="alert">{error}</p>}
      {error && job && <button className="secondary-button" onClick={refresh}>상태 다시 확인</button>}
      {failed && <>{canRetry && <><p className="book-retry-count">다시 시도 가능 횟수 <strong>{remainingRetries}회</strong></p><button className="primary-button" disabled={busy} onClick={() => void retry()}>{busy ? '재시도 요청 중…' : '다시 시도'}</button><p>다시 시도해도 생성권은 차감되지 않아요.</p></>}{canModifyFeedback ? <Link className="book-text-button" to={`/guidebooks/${job.guidebook_id}/regenerate`} onClick={dismiss}>피드백 수정하기</Link> : !isRegenerationFailure && <Link className="book-text-button" to="/guidebooks/new" state={{ guidebookDraft: job?.initial_request }} onClick={dismiss}>조건 수정하기</Link>}</>}
      {canceled && <Link className="primary-button book-button" to="/guidebooks/new" onClick={dismiss}>새 가이드북 만들기</Link>}
      {isRegenerationFailure ? <button className="book-text-button" onClick={() => guidebookConfirmDialog.current?.showModal()}>가이드북으로</button> : <Link className="book-text-button" to="/guidebooks">가이드북 목록으로</Link>}
    </section>
    <dialog ref={guidebookConfirmDialog} className="book-dialog">
      <h2>현재 가이드북으로 확정할까요?</h2>
      <p>수정 요청은 반영되지 않고,<br />현재 가이드북을 그대로 사용하게 돼요.</p>
      <div className="book-dialog-actions"><button className="secondary-button" onClick={() => guidebookConfirmDialog.current?.close()}>계속 수정</button><button className="primary-button" onClick={confirmGuidebook}>가이드북으로</button></div>
    </dialog>
  </main>
}
