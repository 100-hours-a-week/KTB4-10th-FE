import axios from 'axios'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createBook, type Companion, type GenerationRequest } from '../api/guidebooks.ts'
import { companions, dayOffset, message, today, yearLimit } from '../model/conditions.ts'
import { regions } from '../model/regions.ts'
import { isRunning, useGeneration } from '../model/generation.ts'
import { BookHeader } from './GuidebookLayout.tsx'

export function GuidebookCreatePage() {
  const navigate = useNavigate()
  const { track, job } = useGeneration()
  const [form, setForm] = useState<GenerationRequest>({ province: '', city: '', start_date: '', end_date: '', companion: 'ALONE', people_count: 1 })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const submission = useRef<{ key: string; body: GenerationRequest } | null>(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const minDate = today()
  const maxDate = yearLimit(minDate)
  const endLimit = form.start_date ? [dayOffset(form.start_date, 6), maxDate].sort()[0] : maxDate
  const rule = companions[form.companion]

  function update<K extends keyof GenerationRequest>(key: K, value: GenerationRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    submission.current = null; setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current || isRunning(job)) return
    if (!regions[form.province]?.includes(form.city) || !form.start_date || !form.end_date ||
      form.start_date < minDate || form.end_date < form.start_date || form.end_date > maxDate ||
      form.end_date > dayOffset(form.start_date, 6)) {
      setError('지역과 여행 날짜를 확인해 주세요. 여행 기간은 최대 7일이에요.'); return
    }
    locked.current = true; setSubmitting(true); setError('')
    const attempt = submission.current ?? { key: crypto.randomUUID(), body: { ...form } }
    submission.current = attempt
    try {
      const next = await createBook(attempt.body, attempt.key)
      track(next)
      if (mounted.current) navigate(`/guidebooks/generating/${next.job_id}`, { replace: true })
    } catch (reason) {
      if (mounted.current) {
        setError(message(reason))
        // 응답 유실 시 같은 내용·같은 키로 재접수하여 중복 생성을 방지합니다.
        setUncertain(!axios.isAxiosError(reason) || !reason.response || reason.response.status >= 500)
      }
    } finally { locked.current = false; if (mounted.current) setSubmitting(false) }
  }

  return <main className="app-shell book-page">
    <BookHeader title="가이드 생성" />
    <form className="book-form" onSubmit={(event) => void submit(event)}>
      <p className="book-form-intro">다음 여행은<br /><strong>어디로 떠나시나요?</strong></p>
      {isRunning(job) && <p className="book-notice">이미 만들고 있는 가이드북이 있어요. <Link to={`/guidebooks/generating/${job!.job_id}`}>진행 상황 보기</Link></p>}
      <fieldset disabled={submitting || uncertain || isRunning(job)}>
        <legend>여행 조건</legend>
        <section><h2>지역</h2><div className="book-form-row">
          <label><span>시·도</span><select aria-label="시·도" required value={form.province} onChange={(event) => { update('province', event.target.value); update('city', '') }}><option value="">시·도 선택</option>{Object.keys(regions).map((name) => <option key={name}>{name}</option>)}</select></label>
          <label><span>시·군·구</span><select aria-label="시·군·구" required value={form.city} disabled={!form.province} onChange={(event) => update('city', event.target.value)}><option value="">시·군·구 선택</option>{regions[form.province]?.map((name) => <option key={name}>{name}</option>)}</select></label>
        </div></section>
        <section><h2>여행 날짜</h2><div className="book-form-row">
          <label><span>시작일</span><input aria-label="시작일" type="date" required min={minDate} max={maxDate} value={form.start_date} onChange={(event) => { update('start_date', event.target.value); update('end_date', '') }} /></label>
          <label><span>종료일</span><input aria-label="종료일" type="date" required disabled={!form.start_date} min={form.start_date || minDate} max={endLimit} value={form.end_date} onChange={(event) => update('end_date', event.target.value)} /></label>
        </div><small>오늘부터 1년 이내, 최대 7일까지 선택할 수 있어요.</small></section>
        <section><div className="book-form-row">
          <label><span>동행</span><select aria-label="동행" value={form.companion} onChange={(event) => { const value = event.target.value as Companion; update('companion', value); update('people_count', companions[value][1]) }}>{Object.entries(companions).map(([value, item]) => <option key={value} value={value}>{item[0]}</option>)}</select></label>
          <label><span>인원</span><select aria-label="인원" value={form.people_count} onChange={(event) => update('people_count', Number(event.target.value))}>{Array.from({ length: rule[2] - rule[1] + 1 }, (_, i) => rule[1] + i).map((count) => <option value={count} key={count}>{count}명</option>)}</select></label>
        </div><small>본인을 포함한 인원을 선택해 주세요.</small></section>
      </fieldset>
      <div className="book-notice">저장한 취향을 바탕으로 여행을 구성해요.<br />생성권은 가이드북이 완성되면 1개 사용돼요.</div>
      {error && <p className="book-error" role="alert">{error}</p>}
      {uncertain && <p className="book-hint">같은 여행 조건으로 접수 결과를 다시 확인해요.</p>}
      <button className="primary-button" disabled={submitting || isRunning(job)}>{submitting ? '접수 중…' : uncertain ? '같은 요청 다시 확인' : '생성'}</button>
      {uncertain && <button type="button" className="book-text-button" onClick={() => { setUncertain(false); submission.current = null }}>조건 수정</button>}
    </form>
  </main>
}
