import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getBook, type Detail } from '../api/guidebooks.ts'
import { message } from '../model/conditions.ts'
import { regenerationUnavailableMessage, useRegenerationState } from '../model/regeneration.ts'
import { BookCover, BookHeader, State } from './GuidebookLayout.tsx'

export function GuidebookDetailPage() {
  const { guidebookId = '' } = useParams()
  return <DetailContent key={guidebookId} guidebookId={guidebookId} />
}

type GuidebookEventNotice = 'changed' | 'cancelled'

function notificationState(value: unknown): {
  notice: GuidebookEventNotice | null
  returnTo: string
} {
  if (typeof value !== 'object' || value === null) {
    return { notice: null, returnTo: '/guidebooks' }
  }
  const state = value as Record<string, unknown>
  const notice = state.guidebookEventNotice === 'changed' || state.guidebookEventNotice === 'cancelled'
    ? state.guidebookEventNotice
    : null
  return {
    notice,
    returnTo: state.returnTo === '/mypage/notifications'
      ? state.returnTo
      : '/guidebooks',
  }
}

function isUnavailableGuidebook(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const code = error.response?.data?.error?.code
  return error.response?.status === 404 ||
    error.response?.status === 403 ||
    code === 'RESOURCE_NOT_FOUND' ||
    code === 'RESOURCE_FORBIDDEN'
}

function DetailContent({ guidebookId }: { guidebookId: string }) {
  const location = useLocation()
  const { notice, returnTo } = notificationState(location.state)
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState(/^[1-9]\d*$/.test(guidebookId) ? '' : '잘못된 가이드북 주소예요.')
  const [unavailable, setUnavailable] = useState(false)
  const [revision, setRevision] = useState(0)
  const regenerationState = useRegenerationState(data?.regeneration ?? null)
  useEffect(() => {
    const controller = new AbortController()
    if (!/^[1-9]\d*$/.test(guidebookId)) return
    void getBook(guidebookId, controller.signal).then((value) => { if (!controller.signal.aborted) setData(value) })
      .catch((reason) => {
        if (controller.signal.aborted) return
        if (notice && isUnavailableGuidebook(reason)) {
          setUnavailable(true)
          return
        }
        setError(message(reason))
      })
    return () => controller.abort()
  }, [guidebookId, notice, revision])
  return <main className="app-shell book-page">
    <BookHeader title="가이드북" backTo={returnTo} />
    {unavailable && <State>
      <strong>더 이상 확인할 수 없는 가이드북이에요.</strong>
      <span>삭제되었거나 접근할 수 없는 가이드북입니다.</span>
      <Link to="/guidebooks">가이드북 목록으로</Link>
    </State>}
    {error && <State error onRetry={/^[1-9]\d*$/.test(guidebookId) ? () => { setError(''); setRevision((value) => value + 1) } : undefined}>{error}</State>}
    {!data && !error && !unavailable && <State>가이드북을 불러오고 있어요.</State>}
    {data && <article className="book-result">
      <h2>가이드북이 완성됐어요</h2><p className="book-hint">내용을 확인해 주세요</p>
      {notice && <section className={`book-event-notice book-event-notice--${notice}`} role="status">
        <strong>{notice === 'cancelled'
          ? '가이드북에 포함된 행사가 취소되었어요.'
          : '가이드북에 포함된 행사 일정이 변경되었어요.'}</strong>
        <span>생성된 가이드북은 자동으로 수정되지 않으니 이용 전 최신 행사 정보를 확인해 주세요.</span>
      </section>}
      <section className="book-summary"><div className="book-summary-heading"><BookCover thumbnailUrl={data.thumbnail_url} /><div><h3>{data.title}</h3><p>{data.start_date.replaceAll('-', '.')} – {data.end_date.replaceAll('-', '.')}</p><small>{data.people_count}명 · {data.itinerary.length}일</small></div></div>
        <div className="book-days">{data.itinerary.map((day) => <div className="book-day-row" key={day.day_number}>
          <strong>Day {day.day_number}</strong><span>{day.items[0]?.place_snapshot?.title ?? '자유 일정'}{day.items.length > 1 ? ` 외 ${day.items.length - 1}곳` : ''}</span>
        </div>)}</div>
      </section>
      <Link className="primary-button book-button" to={`/guidebooks/${guidebookId}/viewer`} state={{ returnTo: location.pathname }}>가이드북 보기</Link>
      <Link className="secondary-button book-button book-list-button" to="/guidebooks">가이드북 목록</Link>
      {regenerationState?.available && data.regeneration
        ? <Link className="book-text-button book-regenerate-link" to={`/guidebooks/${guidebookId}/regenerate`} state={{ returnTo: location.pathname }}>재생성 ({data.regeneration.remaining_count}회 남음)</Link>
        : <>
          <button className="book-text-button book-regenerate-link" disabled>{data.regeneration ? `재생성 (${data.regeneration.remaining_count}회 남음)` : '재생성'}</button>
          <p className="book-regenerate-unavailable" role="status">{regenerationUnavailableMessage(regenerationState?.reason ?? 'unavailable')}</p>
        </>}
    </article>}
  </main>
}
