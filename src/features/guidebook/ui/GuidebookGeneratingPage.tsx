import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isRunning, useGeneration } from '../model/generation.ts'
import { BookHeader, State } from './GuidebookLayout.tsx'

export function GuidebookGeneratingPage() {
  const { jobId } = useParams()
  const id = Number(jobId)
  const { job, track, error, retry, refresh, busy, dismiss } = useGeneration()
  const navigate = useNavigate()
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
  return <main className="app-shell book-page">
    <BookHeader title={failed ? '가이드북 생성 실패' : canceled ? '가이드북 생성 취소' : '가이드북 생성 중'} />
    <section className="book-generation" aria-live="polite">
      <div className={`book-spark${isRunning(job) && !error ? ' book-spark--active' : ''}`} aria-hidden="true">{failed || canceled ? '!' : '✦'}</div>
      <h2>{failed ? '가이드북을 만들지 못했어요' : canceled ? '생성이 취소되었어요' : '가이드북을 만들고 있어요'}</h2>
      <p>{failed ? '아래 버튼을 눌러 다시 시도해 주세요.' : canceled ? '새 여행 조건으로 다시 시작할 수 있어요.' : '취향에 맞는 여행을 준비하고 있어요.\n다른 화면을 이용해도 괜찮아요.'}</p>
      {isRunning(job) && <ol className="book-generation-steps"><li className="is-done">여행 조건 접수 완료</li><li className={job?.status === 'PROCESSING' ? 'is-active' : ''}>{job?.status === 'PROCESSING' ? '여행 장소와 일정 구성 중' : '생성 시작 대기 중'}</li><li>가이드북 완성 후 알림</li></ol>}
      {error && <p className="book-error" role="alert">{error}</p>}
      {error && job && <button className="secondary-button" onClick={refresh}>상태 다시 확인</button>}
      {failed && <><button className="primary-button" disabled={busy || (job.attempt_count ?? 3) >= 3} onClick={() => void retry()}>{busy ? '재시도 요청 중…' : '재시도'}</button>{(job.attempt_count ?? 0) >= 3 && <p>재시도 가능 횟수를 모두 사용했어요.</p>}<Link className="book-text-button" to="/guidebooks/new" onClick={dismiss}>조건 수정하기</Link></>}
      {canceled && <Link className="primary-button book-button" to="/guidebooks/new" onClick={dismiss}>새 가이드북 만들기</Link>}
      <Link className="book-text-button" to="/guidebooks">가이드북 목록으로</Link>
    </section>
  </main>
}
