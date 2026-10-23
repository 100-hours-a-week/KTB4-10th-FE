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

function DetailContent({ guidebookId }: { guidebookId: string }) {
  const location = useLocation()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState(/^[1-9]\d*$/.test(guidebookId) ? '' : '잘못된 가이드북 주소예요.')
  const [revision, setRevision] = useState(0)
  const regenerationState = useRegenerationState(data?.regeneration ?? null)
  useEffect(() => {
    const controller = new AbortController()
    if (!/^[1-9]\d*$/.test(guidebookId)) return
    void getBook(guidebookId, controller.signal).then((value) => { if (!controller.signal.aborted) setData(value) })
      .catch((reason) => { if (!controller.signal.aborted) setError(message(reason)) })
    return () => controller.abort()
  }, [guidebookId, revision])
  return <main className="app-shell book-page">
    <BookHeader title="가이드북" />
    {error && <State error onRetry={/^[1-9]\d*$/.test(guidebookId) ? () => { setError(''); setRevision((value) => value + 1) } : undefined}>{error}</State>}
    {!data && !error && <State>가이드북을 불러오고 있어요.</State>}
    {data && <article className="book-result">
      <h2>가이드북이 완성됐어요</h2><p className="book-hint">내용을 확인해 주세요</p>
      <section className="book-summary"><div className="book-summary-heading"><BookCover thumbnailUrl={data.thumbnail_url} /><div><h3>{data.title}</h3><p>{data.start_date.replaceAll('-', '.')} – {data.end_date.replaceAll('-', '.')}</p><small>{data.people_count}명 · {data.itinerary.length}일</small></div></div>
        <div className="book-days">{data.itinerary.map((day) => <div className="book-day-row" key={day.day_number}>
          <strong>Day {day.day_number}</strong><span>{day.items[0]?.place_snapshot?.title ?? '자유 일정'}{day.items.length > 1 ? ` 외 ${day.items.length - 1}곳` : ''}</span>
        </div>)}</div>
      </section>
      <Link className="primary-button book-button" to={`/guidebooks/${guidebookId}/viewer`} state={{ returnTo: location.pathname }}>가이드북 보기</Link>
      <Link className="secondary-button book-button book-list-button" to="/guidebooks">가이드북 목록</Link>
      {regenerationState?.available
        ? <Link className="book-text-button book-regenerate-link" to={`/guidebooks/${guidebookId}/regenerate`} state={{ returnTo: location.pathname }}>재생성 ({data.regeneration.remaining_count}회 남음)</Link>
        : <>
          <button className="book-text-button book-regenerate-link" disabled>재생성 ({data.regeneration.remaining_count}회 남음)</button>
          <p className="book-regenerate-unavailable" role="status">{regenerationUnavailableMessage(regenerationState?.reason ?? 'unavailable')}</p>
        </>}
    </article>}
  </main>
}
