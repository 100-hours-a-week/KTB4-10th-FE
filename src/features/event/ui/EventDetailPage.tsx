import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getEventDetail, type EventDetail } from '../api/events.ts'
import './event.css'

type DetailLocationState = { isNew?: boolean }

function displayDate(value: string | null | undefined): string | null {
  if (!value) return null
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}

function displayPeriod(detail: EventDetail | null): string {
  const start = detail?.event_detail?.start_date
  const end = detail?.event_detail?.end_date
  if (!start && !end) return '행사 일정을 확인 중입니다.'
  if (!end || start === end) return displayDate(start) ?? ''
  return `${displayDate(start)} – ${displayDate(end)}`
}

export function EventDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { contentId = '' } = useParams()
  const isNew = (location.state as DetailLocationState | null)?.isNew ?? false
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getEventDetail(contentId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [contentId, revision])

  const image = useMemo(
    () => detail?.images.toSorted((left, right) => left.sort_order - right.sort_order)[0]?.image_url
      ?? detail?.thumbnail_url,
    [detail],
  )
  const title = detail?.title ?? '행사 정보'
  const address = detail?.event_detail?.event_place ?? detail?.address

  return (
    <main className="app-shell event-detail-page">
      <header className="event-detail-header">
        <button type="button" onClick={() => navigate(-1)} aria-label="이전 화면으로">‹</button>
        <span>행사 정보</span>
        <span aria-hidden="true" />
      </header>

      <div className="event-detail-hero">
        {image
          ? <img src={image} alt={`${title} 대표 이미지`} />
          : <div className="event-detail-hero__placeholder"><span>K</span><small>행사 이미지 준비 중</small></div>}
      </div>

      <section className="event-detail-summary">
        <span className="event-detail-badge">행사</span>
        {isNew && <span className="event-detail-badge event-detail-badge--new">NEW</span>}
        <h1>{title}</h1>
        <p>{displayPeriod(detail)}</p>
        <p>{address || '장소 정보 확인 중'}</p>
      </section>

      {loading && (
        <div className="event-detail-loading" role="status">
          <img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" />
          상세 정보를 불러오고 있어요.
        </div>
      )}

      {!loading && error && !detail && (
        <div className="event-detail-loading" role="alert">
          <strong>상세 정보를 불러오지 못했어요.</strong>
          <button type="button" onClick={() => {
            setLoading(true)
            setError(false)
            setRevision((value) => value + 1)
          }}>다시 불러오기</button>
        </div>
      )}

      {detail && (
        <div className="event-detail-content">
          <section>
            <span className="event-detail-section-label">About</span>
            <h2>행사 소개</h2>
            <p className="event-detail-description">
              {detail.description || '행사 소개가 준비되는 대로 업데이트할게요.'}
            </p>
          </section>

          <section>
            <span className="event-detail-section-label">Information</span>
            <h2>이용 정보</h2>
            <dl className="event-detail-info">
              <div><dt>기간</dt><dd>{displayPeriod(detail)}</dd></div>
              {detail.event_detail?.operating_hours && <div><dt>시간</dt><dd>{detail.event_detail.operating_hours}</dd></div>}
              {address && <div><dt>장소</dt><dd>{address}</dd></div>}
              {detail.event_detail?.organizer && <div><dt>주최</dt><dd>{detail.event_detail.organizer}</dd></div>}
              {(detail.event_detail?.organizer_phone || detail.phone) && (
                <div><dt>문의</dt><dd>{detail.event_detail?.organizer_phone ?? detail.phone}</dd></div>
              )}
            </dl>
          </section>

          {detail.homepage_url && (
            <a className="event-homepage-link" href={detail.homepage_url} target="_blank" rel="noreferrer">
              공식 홈페이지에서 더 보기 <span aria-hidden="true">↗</span>
            </a>
          )}

          <p className="event-detail-notice">
            본 정보는 한국관광공사 TourAPI에서 제공받았으며 주최 측 사정에 따라 변경될 수 있습니다.
          </p>
        </div>
      )}

      <Link className="event-detail-back-link" to="/information">다른 행사 둘러보기</Link>
    </main>
  )
}
