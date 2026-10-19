import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { routes } from '../../../shared/config/routes.ts'
import { getCurrentMember } from '../../auth/api/auth.ts'
import {
  NOTIFICATIONS_UPDATED_EVENT,
  type NotificationsUpdatedDetail,
} from '../../notification/model/events.ts'
import { getEvents, getNewEvents, type EventList, type EventListItem } from '../api/events.ts'
import {
  EVENT_MONTH_OPTIONS,
  EVENT_REGION_OPTIONS,
  eventFiltersToSearchParams,
  isCanonicalEventSearch,
  readEventFilters,
  seoulCurrentYear,
  type EventFilters,
} from '../model/eventFilters.ts'
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

function matchesMonth(item: EventListItem, month: string): boolean {
  if (!month) return true
  const startDate = item.event_period?.start_date
  const endDate = item.event_period?.end_date
  if (!startDate && !endDate) return false
  const monthStart = `${month}-01`
  const monthEnd = `${month}-31`
  return (!startDate || startDate <= monthEnd) && (!endDate || endDate >= monthStart)
}

function fixtureEvents(filters: EventFilters): EventList {
  const normalizedQuery = filters.query.toLocaleLowerCase('ko-KR')
  const filteredItems = eventListFixture.items.filter((event) => (
    (!normalizedQuery || event.title.toLocaleLowerCase('ko-KR').includes(normalizedQuery)) &&
    (!filters.regionCode || event.region?.administrative_code.startsWith(filters.regionCode)) &&
    matchesMonth(event, filters.month)
  ))
  const offset = (filters.page - 1) * 10
  return {
    ...eventListFixture,
    items: filteredItems.slice(offset, offset + 10),
    page: filters.page,
    size: 10,
    total_items: filteredItems.length,
    total_pages: Math.ceil(filteredItems.length / 10),
  }
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
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readEventFilters(searchParams), [searchParams])
  const canonicalSearchParams = useMemo(
    () => eventFiltersToSearchParams(filters),
    [filters],
  )
  const [searchDraft, setSearchDraft] = useState({
    source: filters.query,
    value: filters.query,
  })
  const input = searchDraft.source === filters.query ? searchDraft.value : filters.query
  const [data, setData] = useState<EventList | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [newEventCount, setNewEventCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const requestKey = [
    filters.query,
    filters.regionCode,
    filters.month,
    filters.page,
    revision,
  ].join('|')
  const [settledRequestKey, setSettledRequestKey] = useState('')
  const [failedRequestKey, setFailedRequestKey] = useState('')
  const loading = settledRequestKey !== requestKey
  const error = failedRequestKey === requestKey
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!isCanonicalEventSearch(searchParams, canonicalSearchParams)) {
      setSearchParams(canonicalSearchParams, { replace: true })
    }
  }, [canonicalSearchParams, searchParams, setSearchParams])

  useEffect(() => {
    let active = true
    void getCurrentMember()
      .then((member) => {
        if (active) setUnreadCount(member.unread_count)
      })
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
    const controller = new AbortController()
    void getNewEvents(controller.signal)
      .then((newEvents) => {
        if (controller.signal.aborted) return
        setNewIds(new Set(newEvents.items.map((event) => event.content_id)))
        setNewEventCount(newEvents.total_items)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void getEvents({
      query: filters.query,
      regionCode: filters.regionCode,
      month: filters.month,
      page: filters.page,
    }, controller.signal)
      .then((events) => {
        if (controller.signal.aborted) return
        setData(events)
        setFailedRequestKey('')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        if (import.meta.env.DEV) {
          setData(fixtureEvents(filters))
          setNewIds(new Set([eventListFixture.items[0].content_id]))
        } else {
          setFailedRequestKey(requestKey)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledRequestKey(requestKey)
      })
    return () => controller.abort()
  }, [filters, requestKey])

  function updateFilters(next: Partial<EventFilters>) {
    setSearchParams(eventFiltersToSearchParams({ ...filters, ...next }))
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = input.trim().slice(0, 10)
    if (nextQuery === filters.query && filters.page === 1) {
      setRevision((value) => value + 1)
      return
    }
    updateFilters({ query: nextQuery, page: 1 })
  }

  function movePage(nextPage: number) {
    if (nextPage === filters.page || nextPage < 1 || nextPage > (data?.total_pages ?? 0)) return
    updateFilters({ page: nextPage })
  }

  function retry() {
    setRevision((value) => value + 1)
  }

  return (
    <main className="app-shell event-list-page">
      <PageHeader title="행사 정보">
        <button
          className="app-page-header__notification"
          type="button"
          aria-label={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개 확인` : '알림 확인'}
          onClick={() => navigate(routes.notifications)}
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

      <div className="event-list-content">
        {newEventCount > 0 && (
          <div className="event-new-note"><strong>NEW</strong> 오늘 새로 등록된 행사 {newEventCount}개</div>
        )}

        <form className="event-search" role="search" onSubmit={search}>
          <label className="visually-hidden" htmlFor="event-search-input">행사명 검색</label>
          <input
            id="event-search-input"
            value={input}
            maxLength={10}
            onChange={(event) => setSearchDraft({
              source: filters.query,
              value: event.target.value,
            })}
            placeholder="행사명을 검색해보세요 (최대 10자)"
          />
          <button type="submit" aria-label="검색"><span aria-hidden="true" /></button>
        </form>

        <section className="event-filters" aria-label="행사 필터">
          <div className="event-filter-group">
            <h2>지역</h2>
            <div className="event-filter-options" role="group" aria-label="행사 지역">
              <button
                type="button"
                aria-pressed={!filters.regionCode}
                onClick={() => updateFilters({ regionCode: '', page: 1 })}
              >전체</button>
              {EVENT_REGION_OPTIONS.map(({ code, label }) => (
                <button
                  type="button"
                  key={code}
                  aria-pressed={filters.regionCode === code}
                  onClick={() => updateFilters({ regionCode: code, page: 1 })}
                >{label}</button>
              ))}
            </div>
          </div>
          <div className="event-filter-group">
            <h2>월</h2>
            <div className="event-filter-options" role="group" aria-label="행사 개최 월">
              <button
                type="button"
                aria-pressed={!filters.month}
                onClick={() => updateFilters({ month: '', page: 1 })}
              >전체</button>
              {EVENT_MONTH_OPTIONS.map((month) => {
                const value = `${seoulCurrentYear()}-${month}`
                return (
                  <button
                    type="button"
                    key={month}
                    aria-pressed={filters.month === value}
                    onClick={() => updateFilters({ month: value, page: 1 })}
                  >{month}</button>
                )
              })}
            </div>
          </div>
        </section>

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
                <button type="button" onClick={() => movePage(filters.page - 1)} disabled={filters.page === 1} aria-label="이전 페이지">‹</button>
                {pageNumbers(filters.page, data.total_pages).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={pageNumber === filters.page ? 'event-pagination__current' : undefined}
                    aria-current={pageNumber === filters.page ? 'page' : undefined}
                    onClick={() => movePage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button type="button" onClick={() => movePage(filters.page + 1)} disabled={filters.page === data.total_pages} aria-label="다음 페이지">›</button>
              </nav>
            )}
          </section>
        )}

        {loading && <div className="event-state" role="status"><img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" /><strong>행사를 찾고 있어요</strong><span>잠시만 기다려 주세요.</span></div>}
        {!loading && error && <div className="event-state" role="alert"><span className="event-state__symbol" aria-hidden="true">!</span><strong>행사 정보를 불러오지 못했어요</strong><span>잠시 후 다시 시도해 주세요.</span><button type="button" onClick={retry}>다시 불러오기</button></div>}
        {!loading && !error && data?.items.length === 0 && <div className="event-state"><span className="event-state__symbol" aria-hidden="true">⌕</span><strong>검색 결과가 없어요</strong><span>검색어나 필터를 바꿔 다시 찾아보세요.</span></div>}
      </div>
      <BottomNavigation />
    </main>
  )
}
