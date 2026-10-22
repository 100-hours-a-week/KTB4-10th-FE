import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listFavorites,
  removeFavorite,
  type FavoriteListItem,
  type FavoriteListPage,
} from '../../map/api/favorites.ts'
import { routes } from '../../../shared/config/routes.ts'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { Toast } from '../../../shared/ui/Toast.tsx'
import './favorite-page.css'

function displayDate(value: string | null): string | null {
  if (!value) return null
  return value.replaceAll('-', '.')
}

function itemDescription(item: FavoriteListItem): string {
  const start = displayDate(item.event_period?.start_date ?? null)
  const end = displayDate(item.event_period?.end_date ?? null)
  if (start && end && start !== end) return `${start} – ${end}`
  return start ?? end ?? item.address ?? '상세 정보 준비 중'
}

function FavoriteThumbnail({ item }: { item: FavoriteListItem }) {
  const [failed, setFailed] = useState(false)
  if (item.thumbnail_url && !failed) {
    return <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  }
  return <span aria-hidden="true">{item.content_type === 'EVENT' ? '행사' : '장소'}</span>
}

function FavoriteSkeleton() {
  return <div className="favorite-skeleton" role="status" aria-label="즐겨찾기 불러오는 중">
    {Array.from({ length: 3 }, (_, index) => <div className="favorite-skeleton__card" key={index} aria-hidden="true">
      <span className="favorite-skeleton__image" />
      <span className="favorite-skeleton__copy"><i /><i /><i /></span>
    </div>)}
  </div>
}

export function FavoritePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<FavoriteListPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const request = useRef<AbortController | null>(null)
  const loadLock = useRef(false)

  useEffect(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    loadLock.current = true
    void listFavorites(undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result)
          setError('')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('즐겨찾기를 불러오지 못했어요.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          loadLock.current = false
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [revision])

  const loadMore = useCallback(async () => {
    if (!data?.next_cursor || loadLock.current) return
    const controller = new AbortController()
    request.current = controller
    loadLock.current = true
    setLoading(true)
    try {
      const next = await listFavorites(data.next_cursor, controller.signal)
      if (!controller.signal.aborted) setData((current) => ({
        ...next,
        items: [
          ...(current?.items ?? []),
          ...next.items.filter((item) => !current?.items.some(
            (currentItem) => currentItem.content_id === item.content_id,
          )),
        ],
      }))
    } catch {
      if (!controller.signal.aborted) setToast('즐겨찾기를 더 불러오지 못했어요.')
    } finally {
      if (!controller.signal.aborted) {
        loadLock.current = false
        setLoading(false)
      }
    }
  }, [data])

  async function remove(item: FavoriteListItem) {
    if (pendingId) return
    setPendingId(item.content_id)
    try {
      await removeFavorite(item.content_id)
      setData((current) => current ? {
        ...current,
        items: current.items.filter(({ content_id }) => content_id !== item.content_id),
      } : current)
    } catch {
      setToast('즐겨찾기에서 삭제하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setPendingId(null)
    }
  }

  return <main className="app-shell favorite-page">
    <PageHeader
      title="즐겨찾기"
      leading={<button className="favorite-page__back" type="button" onClick={() => navigate(routes.myPage)} aria-label="마이페이지로">‹</button>}
    />
    <div className="favorite-page__content">
      {loading && !data && <FavoriteSkeleton />}
      {!loading && error && !data && <div className="favorite-state" role="alert">
        <strong>즐겨찾기를 불러오지 못했어요.</strong>
        <button type="button" onClick={() => { setLoading(true); setRevision((value) => value + 1) }}>다시 불러오기</button>
      </div>}
      {!loading && data?.items.length === 0 && <div className="favorite-state favorite-state--empty">
        <img src="/assets/favorite/favorite.png" alt="" aria-hidden="true" />
        <strong>아직 저장한 장소나 행사가 없어요</strong>
        <p>지도와 행사 정보에서 관심 있는 곳을 저장해 보세요.</p>
      </div>}
      {data && data.items.length > 0 && <ul className="favorite-list">
        {data.items.map((item) => <li className="favorite-card" key={item.content_id}>
          {item.content_type === 'EVENT'
            ? <Link className="favorite-card__main" to={`/events/${encodeURIComponent(item.content_id)}`} state={{ returnTo: routes.favorites, initialFavorite: true }}>
              <span className="favorite-card__thumbnail"><FavoriteThumbnail item={item} /></span>
              <FavoriteCopy item={item} />
            </Link>
            : <div className="favorite-card__main">
              <span className="favorite-card__thumbnail"><FavoriteThumbnail item={item} /></span>
              <FavoriteCopy item={item} />
            </div>}
          <button
            className="favorite-card__toggle"
            type="button"
            aria-label={`${item.title} 즐겨찾기 해제`}
            aria-pressed="true"
            disabled={pendingId !== null}
            onClick={() => void remove(item)}
          >
            <img src="/assets/favorite/favorite-selected.png" alt="" aria-hidden="true" />
          </button>
        </li>)}
      </ul>}
      {loading && data && <p className="favorite-page__more-status" role="status">즐겨찾기를 더 불러오고 있어요.</p>}
      {data?.has_more && !loading && <button className="secondary-button favorite-page__more" type="button" onClick={() => void loadMore()}>더 보기</button>}
    </div>
    {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
  </main>
}

function FavoriteCopy({ item }: { item: FavoriteListItem }) {
  return <span className="favorite-card__copy">
    <small>{item.content_type === 'EVENT' ? '행사' : '장소'}</small>
    <strong>{item.title}</strong>
    <span>{itemDescription(item)}</span>
    {item.content_type === 'EVENT' && item.address && <span>{item.address}</span>}
  </span>
}
