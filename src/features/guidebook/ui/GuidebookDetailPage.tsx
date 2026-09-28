import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBook, type Detail } from '../api/guidebooks.ts'
import { message } from '../model/conditions.ts'
import { BookCover, BookHeader, State } from './GuidebookLayout.tsx'

export function GuidebookDetailPage() {
  const { guidebookId = '' } = useParams()
  return <DetailContent key={guidebookId} guidebookId={guidebookId} />
}

function DetailContent({ guidebookId }: { guidebookId: string }) {
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState(/^[1-9]\d*$/.test(guidebookId) ? '' : '잘못된 가이드북 주소예요.')
  const [revision, setRevision] = useState(0)
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
      <section className="book-summary"><div className="book-summary-heading"><BookCover /><div><h3>{data.title}</h3><p>{data.start_date} – {data.end_date}</p><small>{data.people_count}명 · {data.itinerary.length}일</small></div></div>
        <div className="book-days">{data.itinerary.map((day) => <details key={day.day_number}>
          <summary><strong>Day {day.day_number}</strong><span>{day.items[0]?.place_snapshot?.title ?? '자유 일정'}{day.items.length > 1 ? ` 외 ${day.items.length - 1}곳` : ''}</span></summary>
          <p>{day.itinerary_date}</p><ol>{day.items.map((item) => <li key={item.item_id}><time>{item.scheduled_time?.slice(0, 5) ?? '시간 미정'}</time><span>{item.place_snapshot?.title ?? '여행 장소'}</span></li>)}</ol>
        </details>)}</div>
      </section>
      <Link className="primary-button book-button" to={`/guidebooks/${guidebookId}/viewer`}>가이드북 보기</Link>
    </article>}
  </main>
}
