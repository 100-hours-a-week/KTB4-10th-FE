import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { routes } from '../../../shared/config/routes.ts'
import { getCurrentMember } from '../../auth/api/auth.ts'
import {
  NOTIFICATIONS_UPDATED_EVENT,
  type NotificationsUpdatedDetail,
} from '../../notification/model/events.ts'
import {
  getEvents,
  getNewEvents,
  type EventList,
  type EventListItem,
  type NewEventItem,
  type NewEventList,
} from '../api/events.ts'
import {
  EVENT_MONTH_OPTIONS,
  EVENT_REGION_OPTIONS,
  eventFiltersToSearchParams,
  isCanonicalEventSearch,
  readEventFilters,
  seoulCurrentYear,
  type EventFilters,
} from '../model/eventFilters.ts'
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

function monthLabel(month: string): string {
  return `${Number(month)}월`
}

function pageNumbers(currentPage: number, totalPages: number): number[] {
  const first = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const last = Math.min(totalPages, first + 4)
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

function newEventToListItem(event: NewEventItem): EventListItem {
  return {
    content_id: event.content_id,
    title: event.title,
    category: 'EVENT',
    region: null,
    address: event.address,
    thumbnail_url: event.thumbnail_url,
    event_period: {
      start_date: event.start_date,
      end_date: event.end_date,
    },
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
  const location = useLocation()
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
  const [newData, setNewData] = useState<NewEventList | null>(null)
  const [newEventFailed, setNewEventFailed] = useState(false)
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
  const isNewView = filters.view === 'new'
  const [unreadCount, setUnreadCount] = useState(0)
  const [openFilter, setOpenFilter] = useState<'region' | 'month' | null>(null)
  const filterRef = useRef<HTMLElement>(null)

  const selectedRegionLabel = EVENT_REGION_OPTIONS.find(
    ({ code }) => code === filters.regionCode,
  )?.label
  const selectedMonthLabel = filters.month ? monthLabel(filters.month.slice(-2)) : undefined

  useEffect(() => {
    if (!isCanonicalEventSearch(searchParams, canonicalSearchParams)) {
      setSearchParams(canonicalSearchParams, { replace: true })
    }
  }, [canonicalSearchParams, searchParams, setSearchParams])

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!filterRef.current?.contains(event.target as Node)) setOpenFilter(null)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenFilter(null)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

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
        setNewData(newEvents)
        setNewIds(new Set(newEvents.items.map((event) => event.content_id)))
        setNewEventCount(newEvents.total_items)
        setNewEventFailed(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setNewEventFailed(true)
      })
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
        setFailedRequestKey(requestKey)
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledRequestKey(requestKey)
      })
    return () => controller.abort()
  }, [filters, requestKey])

  function updateFilters(next: Partial<EventFilters>) {
    setSearchParams(eventFiltersToSearchParams({ ...filters, ...next }))
  }

  function selectRegion(regionCode: string) {
    updateFilters({ regionCode, page: 1 })
    setOpenFilter(null)
  }

  function selectMonth(month: string) {
    updateFilters({ month, page: 1 })
    setOpenFilter(null)
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

  function showNewEvents() {
    updateFilters({ view: 'new' })
  }

  function showAllEvents() {
    updateFilters({ view: 'all' })
  }

  const visibleItems = isNewView
    ? newData?.items.map(newEventToListItem) ?? []
    : data?.items ?? []
  const visibleCount = isNewView ? newEventCount : data?.total_items ?? 0
  const viewLoading = isNewView ? newData === null && !newEventFailed : loading
  const viewError = isNewView ? newEventFailed : error

  return (
    <main className="app-shell event-list-page">
      <PageHeader title="행사 정보">
        <button
          className="app-page-header__notification"
          type="button"
          aria-label={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개 확인` : '알림 확인'}
          onClick={() => navigate(routes.notifications, {
            state: { returnTo: `${location.pathname}${location.search}` },
          })}
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

      <div className={`event-list-content${isNewView ? ' event-list-content--new' : ''}`}>
        {!isNewView && newEventCount > 0 && (
          <button className="event-new-note event-new-note--button" type="button" onClick={showNewEvents}>
            <span><strong>NEW</strong>{` 오늘 새로 등록된 행사 ${newEventCount}개`}</span>
            <span className="event-new-note__arrow" aria-hidden="true">›</span>
          </button>
        )}

        {isNewView && (
          <button className="event-new-back" type="button" onClick={showAllEvents}>
            <span aria-hidden="true">‹</span> 전체 행사로 돌아가기
          </button>
        )}

        {!isNewView && <>
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

        <section ref={filterRef} className="event-filters" aria-label="행사 필터">
          <div className="event-filter-dropdown">
            <button
              className="event-filter-dropdown__trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={openFilter === 'region'}
              aria-label={`지역 필터: ${selectedRegionLabel ?? '전체'}`}
              onClick={() => setOpenFilter((current) => current === 'region' ? null : 'region')}
            >
              <span className="event-filter-dropdown__copy">
                <span className="event-filter-dropdown__label">지역</span>
                <strong>{selectedRegionLabel ?? '전체'}</strong>
              </span>
              <span className="event-filter-dropdown__chevron" aria-hidden="true" />
            </button>
            {openFilter === 'region' && (
              <div className="event-filter-dropdown__menu" role="listbox" aria-label="행사 지역">
                <button
                  type="button"
                  role="option"
                  aria-selected={!filters.regionCode}
                  onClick={() => selectRegion('')}
                >전체</button>
                {EVENT_REGION_OPTIONS.map(({ code, label }) => (
                  <button
                    type="button"
                    role="option"
                    key={code}
                    aria-selected={filters.regionCode === code}
                    onClick={() => selectRegion(code)}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>

          <div className="event-filter-dropdown">
            <button
              className="event-filter-dropdown__trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={openFilter === 'month'}
              aria-label={`월 필터: ${selectedMonthLabel ?? '전체'}`}
              onClick={() => setOpenFilter((current) => current === 'month' ? null : 'month')}
            >
              <span className="event-filter-dropdown__copy">
                <span className="event-filter-dropdown__label">월</span>
                <strong>{selectedMonthLabel ?? '전체'}</strong>
              </span>
              <span className="event-filter-dropdown__chevron" aria-hidden="true" />
            </button>
            {openFilter === 'month' && (
              <div className="event-filter-dropdown__menu" role="listbox" aria-label="행사 개최 월">
                <button
                  type="button"
                  role="option"
                  aria-selected={!filters.month}
                  onClick={() => selectMonth('')}
                >전체</button>
                {EVENT_MONTH_OPTIONS.map((month) => {
                  const value = `${seoulCurrentYear()}-${month}`
                  return (
                    <button
                      type="button"
                      role="option"
                      key={month}
                      aria-selected={filters.month === value}
                      onClick={() => selectMonth(value)}
                    >{monthLabel(month)}</button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
        </>}

        {isNewView && !viewLoading && !viewError && visibleItems.length > 0 && (
          <section className="event-new-section" aria-labelledby="new-events-title">
            <div className="event-section-heading">
              <div><span>New Events</span><h2 id="new-events-title">오늘 새로 등록된 행사</h2></div>
              <strong>{visibleCount}</strong>
            </div>
            <ul className="event-list">{visibleItems.map((event) => (
              <EventCard key={event.content_id} event={event} isNew />
            ))}</ul>
          </section>
        )}

        {!isNewView && !loading && !error && data && data.items.length > 0 && (
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

        {!isNewView && loading && <div className="event-state" role="status"><img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" /><strong>행사를 찾고 있어요</strong><span>잠시만 기다려 주세요.</span></div>}
        {!isNewView && !loading && error && <div className="event-state" role="alert"><span className="event-state__symbol" aria-hidden="true">!</span><strong>행사 정보를 불러오지 못했어요</strong><span>잠시 후 다시 시도해 주세요.</span><button type="button" onClick={retry}>다시 불러오기</button></div>}
        {!isNewView && !loading && !error && data?.items.length === 0 && <div className="event-state"><span className="event-state__symbol" aria-hidden="true">⌕</span><strong>검색 결과가 없어요</strong><span>검색어나 필터를 바꿔 다시 찾아보세요.</span></div>}
        {isNewView && viewLoading && <div className="event-state event-state--new" role="status"><img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" /><strong>새로운 행사를 찾고 있어요</strong><span>잠시만 기다려 주세요.</span></div>}
        {isNewView && !viewLoading && viewError && <div className="event-state event-state--new" role="alert"><span className="event-state__symbol" aria-hidden="true">!</span><strong>새로운 행사를 불러오지 못했어요</strong><span>잠시 후 다시 시도해 주세요.</span></div>}
        {isNewView && !viewLoading && !viewError && visibleItems.length === 0 && <div className="event-state event-state--new"><span className="event-state__symbol" aria-hidden="true">⌕</span><strong>오늘 새로 등록된 행사가 없어요</strong><span>전체 행사로 돌아가 다른 행사를 살펴보세요.</span></div>}
      </div>
      <BottomNavigation />
    </main>
  )
}
