import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getBook, regenerateBook, type Detail } from '../api/guidebooks.ts'
import { message } from '../model/conditions.ts'
import { useGeneration } from '../model/generation.ts'
import { regenerationUnavailableMessage, useRegenerationState } from '../model/regeneration.ts'
import { BookHeader } from './GuidebookLayout.tsx'

const feedbackLimit = 200

function idempotencyKey(guidebookId: string) {
  return `guidebook-${guidebookId}-regeneration-${crypto.randomUUID()}`
}

export function GuidebookRegeneratePage() {
  const { guidebookId = '' } = useParams()
  const id = Number(guidebookId)
  const location = useLocation()
  const navigate = useNavigate()
  const { track } = useGeneration()
  const [guidebook, setGuidebook] = useState<Detail | null>(null)
  const [availabilityError, setAvailabilityError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const key = useRef(idempotencyKey(guidebookId))
  const returnToState = (location.state as { returnTo?: unknown } | null)?.returnTo
  const returnTo = typeof returnToState === 'string' ? returnToState : `/guidebooks/${guidebookId}`
  const trimmedFeedback = feedback.trim()
  const validId = Number.isSafeInteger(id) && id > 0
  const regenerationState = useRegenerationState(guidebook?.regeneration ?? null)
  const canRegenerate = validId && regenerationState?.available === true

  useEffect(() => {
    if (!validId) return
    const controller = new AbortController()
    void getBook(guidebookId, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setGuidebook(value) })
      .catch((reason) => { if (!controller.signal.aborted) setAvailabilityError(message(reason)) })
    return () => controller.abort()
  }, [guidebookId, validId])

  async function submit() {
    if (!canRegenerate || !trimmedFeedback || submitting) return
    setSubmitting(true); setError('')
    try {
      const job = await regenerateBook(id, trimmedFeedback, key.current)
      track(job, Date.now())
      navigate(`/guidebooks/generating/${job.job_id}`, { replace: true })
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="app-shell book-page">
    <BookHeader title="가이드북 수정" backTo={returnTo} />
    <section className="book-regenerate">
      <h2>고치고 싶은 부분이 있으면 알려주세요</h2>
      <label htmlFor="guidebook-feedback">
        <span>수정 요청</span>
        <span className="book-feedback-count" aria-live="polite">{feedback.length} / {feedbackLimit}</span>
      </label>
      <textarea
        id="guidebook-feedback"
        value={feedback}
        maxLength={feedbackLimit}
        rows={10}
        placeholder="예) 둘째 날은 조금 더 여유롭게 구성해 주세요."
        onChange={(event) => setFeedback(event.target.value)}
        disabled={submitting || !canRegenerate}
      />
      <p className="book-feedback-hint">방문 장소, 방문 순서, 일정의 분위기처럼 바꾸고 싶은 내용을 자유롭게 적어주세요.</p>
      {!validId && <p className="book-error" role="alert">잘못된 가이드북 주소예요.</p>}
      {validId && !guidebook && !availabilityError && <p className="book-regeneration-status" role="status">재생성 가능 여부를 확인하고 있어요.</p>}
      {availabilityError && <p className="book-error" role="alert">{availabilityError}</p>}
      {guidebook && !regenerationState?.available && <p className="book-error" role="alert">{regenerationUnavailableMessage(regenerationState?.reason ?? 'unavailable')}</p>}
      {error && <p className="book-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={!canRegenerate || !trimmedFeedback || submitting} onClick={() => void submit()}>
        {submitting ? '수정 요청 중…' : '수정 요청'}
      </button>
      <button className="book-text-button" disabled={submitting} onClick={() => navigate(returnTo, { replace: true })}>수정 취소</button>
    </section>
  </main>
}
