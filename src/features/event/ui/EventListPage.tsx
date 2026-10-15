import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { routes } from '../../../shared/config/routes.ts'
import { getEvents, getNewEvents, type EventList, type EventListItem } from '../api/events.ts'
import { eventListFixture } from '../model/eventFixtures.ts'
import './event.css'

function dateText(value: string | null | undefined): string {
  if (!value) return '일정 확인 중'
  return value.replaceAll('-', '.')
}

function periodText(item: EventListItem): string {
  const start = item.event_period?.start_date
  const end = item.event_period?.end_date
  if (!start && !end) return '일정 확인 중'
  if (!end || start === end) return dateText(start)
  return `${dateText(start)} – ${dateText(end)}`
}

function pageNumbers(currentPage: number, totalPages: number): number[] {
  const first = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const last = Math.min(totalPages, first + 4)
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

function EventCard({ event, isNew }: { event: EventListItem; isNew: boolean }) {
  return (
    <li>
      <Link
        className="event-card"
        to={`/events/${encodeURIComponent(event.content_id)}`}
        state={{ isNew }}
      >
        <span className="event-card__image">
          {event.thumbnail_url
            ? <img src={event.thumbnail_url} alt="" loading="lazy" decoding="async" />
            : <span aria-hidden="true">K</span>}
          {isNew && <span className="event-card__new">NEW</span>}
        </span>
        <span className="event-card__body">
          <span className="event-card__category">{isNew ? '오늘 등록된 행사' : '행사'}</span>
          <strong>{event.title}</strong>
          <span>{periodText(event)}</span>
          <span>{event.address ?? event.region?.name ?? '장소 정보 확인 중'}</span>
        </span>
        <span className="event-card__arrow" aria-hidden="true">›</span>
      </Link>
    </li>
  )
}

export function EventListPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<EventList | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      getEvents(query, page, controller.signal),
      getNewEvents(controller.signal).catch(() => null),
    ])
      .then(([events, newEvents]) => {
        if (controller.signal.aborted) return
        setData(events)
        setNewIds(new Set(newEvents?.items.map((event) => event.content_id) ?? []))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        if (import.meta.env.DEV) {
          const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
          const items = normalizedQuery
            ? eventListFixture.items.filter((event) => (
              event.title.toLocaleLowerCase('ko-KR').includes(normalizedQuery)
            ))
            : eventListFixture.items
          setData({ ...eventListFixture, items, total_items: items.length })
          setNewIds(new Set([eventListFixture.items[0].content_id]))
        } else {
          setError(true)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, query, revision])

  const visibleNewCount = useMemo(
    () => data?.items.filter((event) => newIds.has(event.content_id)).length ?? 0,
    [data?.items, newIds],
  )

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(false)
    setPage(1)
    setQuery(input.trim())
  }

  function movePage(nextPage: number) {
    if (nextPage === page || nextPage < 1 || nextPage > (data?.total_pages ?? 0)) return
    setLoading(true)
    setError(false)
    setPage(nextPage)
  }

  function retry() {
    setLoading(true)
    setError(false)
    setRevision((value) => value + 1)
  }

  return (
    <main className="app-shell event-list-page">
      <PageHeader title="이런 행사 어때요?">
        <button className="app-page-header__notification" type="button" aria-label="알림 확인" onClick={() => navigate(routes.notifications)}>
          <img src="/assets/mypage/bell-empty.png" alt="" aria-hidden="true" />
        </button>
      </PageHeader>

      <div className="event-list-content">
        <form className="event-search" role="search" onSubmit={search}>
          <label className="visually-hidden" htmlFor="event-search-input">행사명 검색</label>
          <input id="event-search-input" value={input} maxLength={10} onChange={(event) => setInput(event.target.value)} placeholder="행사명을 검색해보세요 (최대 10자)" />
          <button type="submit" aria-label="검색"><span aria-hidden="true" /></button>
        </form>

        {visibleNewCount > 0 && !loading && (
          <div className="event-new-note"><strong>NEW</strong> 오늘 새로 등록된 행사 {visibleNewCount}개</div>
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <section className="event-new-section" aria-labelledby="events-title">
            <div className="event-section-heading">
              <div><span>Events</span><h2 id="events-title">행사 둘러보기</h2></div>
              <strong>{data.total_items}</strong>
            </div>
            <ul className="event-list">{data.items.map((event) => (
              <EventCard key={event.content_id} event={event} isNew={newIds.has(event.content_id)} />
            ))}</ul>
            {data.total_pages > 1 && (
              <nav className="event-pagination" aria-label="행사 목록 페이지">
                <button type="button" onClick={() => movePage(page - 1)} disabled={page === 1} aria-label="이전 페이지">‹</button>
                {pageNumbers(page, data.total_pages).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={pageNumber === page ? 'event-pagination__current' : undefined}
                    aria-current={pageNumber === page ? 'page' : undefined}
                    onClick={() => movePage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button type="button" onClick={() => movePage(page + 1)} disabled={page === data.total_pages} aria-label="다음 페이지">›</button>
              </nav>
            )}
          </section>
        )}

        {loading && <div className="event-state" role="status"><img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" /><strong>행사를 찾고 있어요</strong><span>잠시만 기다려 주세요.</span></div>}
        {!loading && error && <div className="event-state" role="alert"><span className="event-state__symbol" aria-hidden="true">!</span><strong>행사 정보를 불러오지 못했어요</strong><span>잠시 후 다시 시도해 주세요.</span><button type="button" onClick={retry}>다시 불러오기</button></div>}
        {!loading && !error && data?.items.length === 0 && <div className="event-state"><span className="event-state__symbol" aria-hidden="true">⌕</span><strong>검색 결과가 없어요</strong><span>다른 행사명으로 다시 찾아보세요.</span></div>}
      </div>
      <BottomNavigation />
    </main>
  )
}
