import { useCallback, useEffect, useRef, useState } from 'react'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { Toast } from '../../../shared/ui/Toast.tsx'
import {
  clearMapContentCache,
  filterContentsWithinBounds,
  getMapContents,
  type MapBounds,
  type MapCluster,
  type MapContentItem,
} from '../api/map.ts'
import { removeFavorite, saveFavorite } from '../api/favorites.ts'
import { updatePushEnabled } from '../api/settings.ts'
import type { KakaoMap } from '../lib/kakaoMaps.ts'
import { KakaoMapCanvas } from './KakaoMapCanvas.tsx'
import { PermissionModal } from './PermissionModal.tsx'

const DEFAULT_CENTER = { latitude: 37.3952969470752, longitude: 127.110449292622 }
const LOCATION_PROMPT_KEY = 'kgb.location-prompt-completed'
const NOTIFICATION_PROMPT_KEY = 'kgb.notification-prompt-completed'
const SHEET_PAGE_SIZE = 20

type PermissionStep = 'location' | 'notification' | null
type SheetLevel = 'collapsed' | 'default' | 'expanded'

function initialPermissionStep(): PermissionStep {
  return localStorage.getItem(LOCATION_PROMPT_KEY) ? null : 'location'
}

function shouldRestoreCurrentPosition(): boolean {
  return Boolean(
    localStorage.getItem(LOCATION_PROMPT_KEY) &&
    navigator.geolocation &&
    navigator.permissions,
  )
}

function eventPeriodText(item: MapContentItem): string | null {
  if (!item.event_period) return null
  return `${item.event_period.start_date} ~ ${item.event_period.end_date}`
}

type MapContentCardProps = {
  item: MapContentItem
  favoritePending: boolean
  onSelect?: () => void
  onToggleFavorite: () => void
}

function MapContentCard({
  item,
  favoritePending,
  onSelect,
  onToggleFavorite,
}: MapContentCardProps) {
  return (
    <article className="map-content-card">
      <button
        type="button"
        className="map-content-card__select"
        aria-label={`${item.title} 선택`}
        onClick={onSelect}
        disabled={!onSelect}
      >
        <span className="map-content-card__thumbnail">
          {item.thumbnail_url
            ? <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" />
            : <span aria-hidden="true">{item.content_type === 'EVENT' ? '행사' : '장소'}</span>}
        </span>
        <span className="map-content-card__body">
          <span>{item.is_in_guidebook ? '가이드북 장소' : item.content_type === 'EVENT' ? '행사' : '관광지'}</span>
          <strong className="map-content-card__title">{item.title}</strong>
          <span className="map-content-card__description">{eventPeriodText(item) ?? item.address}</span>
        </span>
      </button>
      <button
        type="button"
        className={`map-content-card__favorite${item.is_favorite ? ' map-content-card__favorite--active' : ''}`}
        aria-label={item.is_favorite ? `${item.title} 즐겨찾기 해제` : `${item.title} 즐겨찾기 저장`}
        aria-pressed={item.is_favorite}
        disabled={favoritePending}
        onClick={onToggleFavorite}
      >
        <span aria-hidden="true">{item.is_favorite ? '★' : '☆'}</span>
      </button>
    </article>
  )
}

export function MapPage() {
  const mapRef = useRef<KakaoMap | null>(null)
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isRestoringPosition, setIsRestoringPosition] = useState(shouldRestoreCurrentPosition)
  const latestContentRequestRef = useRef(0)
  const [items, setItems] = useState<MapContentItem[]>([])
  const [clusters, setClusters] = useState<MapCluster[]>([])
  const [responseMode, setResponseMode] = useState<'CONTENT' | 'CLUSTER'>('CONTENT')
  const [visibleSheetItemCount, setVisibleSheetItemCount] = useState(SHEET_PAGE_SIZE)
  const [selectedItem, setSelectedItem] = useState<MapContentItem | null>(null)
  const [isContentsLoading, setIsContentsLoading] = useState(false)
  const [contentsError, setContentsError] = useState(false)
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>('collapsed')
  const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const sheetDragStart = useRef<{ pointerY: number; height: number } | null>(null)
  const sheetWasDragged = useRef(false)
  const [permissionStep, setPermissionStep] = useState<PermissionStep>(initialPermissionStep)
  const [toast, setToast] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null)

  const requestContents = useCallback((bounds: MapBounds) => {
    const requestId = latestContentRequestRef.current + 1
    latestContentRequestRef.current = requestId
    setIsContentsLoading(true)
    setContentsError(false)
    getMapContents(bounds)
      .then((result) => {
        if (requestId !== latestContentRequestRef.current) return
        const visibleItems = filterContentsWithinBounds(result.items, bounds)
        setItems(visibleItems)
        setClusters(result.clusters)
        setResponseMode(result.mode)
        setVisibleSheetItemCount(SHEET_PAGE_SIZE)
        setSelectedItem((current) => (
          current && visibleItems.some((item) => item.content_id === current.content_id)
            ? current
            : null
        ))
      })
      .catch(() => {
        if (requestId !== latestContentRequestRef.current) return
        setContentsError(true)
        setToast('주변 관광 정보를 불러오지 못했어요.')
      })
      .finally(() => {
        if (requestId === latestContentRequestRef.current) setIsContentsLoading(false)
      })
  }, [])

  const requestCurrentPosition = useCallback((afterRequest?: () => void) => {
    if (!navigator.geolocation) {
      setToast('이 브라우저에서는 위치 기능을 사용할 수 없어요.')
      afterRequest?.()
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude }
        setPosition(next)
        afterRequest?.()
      },
      () => {
        setToast('위치 권한이 없어 서울시청 주변을 보여드려요.')
        afterRequest?.()
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(() => {
    if (!isRestoringPosition) return
    let active = true

    navigator.permissions.query({ name: 'geolocation' })
      .then((permission) => {
        if (!active) return
        if (permission.state !== 'granted') {
          setIsRestoringPosition(false)
          return
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            if (!active) return
            setPosition({ latitude: coords.latitude, longitude: coords.longitude })
            setIsRestoringPosition(false)
          },
          () => {
            if (active) setIsRestoringPosition(false)
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        )
      })
      .catch(() => {
        if (active) setIsRestoringPosition(false)
      })

    return () => {
      active = false
    }
  }, [isRestoringPosition])

  const continueToNotification = () => {
    localStorage.setItem(LOCATION_PROMPT_KEY, 'true')
    if (
      !localStorage.getItem(NOTIFICATION_PROMPT_KEY) &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      setPermissionStep('notification')
      return
    }
    setPermissionStep(null)
  }

  const allowLocation = () => requestCurrentPosition(continueToNotification)

  const skipLocation = () => {
    setToast('서울시청 주변 지도를 먼저 보여드려요.')
    continueToNotification()
  }

  const finishNotification = async (allow: boolean) => {
    localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
    setPermissionStep(null)

    let enabled = false
    if (allow && 'Notification' in window) {
      enabled = (await Notification.requestPermission()) === 'granted'
    }
    try {
      await updatePushEnabled(enabled)
    } catch {
      setToast('알림 설정은 마이페이지에서 다시 변경할 수 있어요.')
    }
  }

  const changeZoom = (difference: number) => {
    const map = mapRef.current
    if (!map) return
    map.setLevel(Math.min(16, Math.max(1, map.getLevel() + difference)), {
      anchor: map.getCenter(),
    })
  }

  const sheetHeights = () => ({
    collapsed: 48,
    default: 174,
    expanded: Math.min(window.innerHeight * 0.64, 580),
  })

  const moveSheet = (clientY: number) => {
    const start = sheetDragStart.current
    if (!start) return
    const heights = sheetHeights()
    const nextHeight = start.height + start.pointerY - clientY
    const constrainedHeight = Math.min(heights.expanded, Math.max(heights.collapsed, nextHeight))
    if (Math.abs(constrainedHeight - start.height) >= 4) sheetWasDragged.current = true
    setSheetDragHeight(constrainedHeight)
  }

  const finishSheetDrag = (pointerId: number, clientY: number, element: HTMLButtonElement) => {
    moveSheet(clientY)
    const start = sheetDragStart.current
    if (!start) return
    const heights = sheetHeights()
    const currentHeight = Math.min(
      heights.expanded,
      Math.max(heights.collapsed, start.height + start.pointerY - clientY),
    )
    const nextLevel = (Object.entries(heights) as Array<[SheetLevel, number]>)
      .reduce((closest, candidate) => (
        Math.abs(candidate[1] - currentHeight) < Math.abs(closest[1] - currentHeight)
          ? candidate
          : closest
      ))[0]
    setSheetLevel(nextLevel)
    setSheetDragHeight(null)
    sheetDragStart.current = null
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId)
  }

  const displayedItem = selectedItem ?? items[0] ?? null
  const visibleSheetItems = items.slice(0, visibleSheetItemCount)
  const clusteredContentCount = clusters.reduce((total, cluster) => total + cluster.count, 0)
  const handleMapClick = useCallback(() => {
    setSelectedItem(null)
    setSheetLevel((current) => current === 'expanded' ? 'default' : 'collapsed')
    setSheetDragHeight(null)
  }, [])

  const toggleFavorite = async (item: MapContentItem) => {
    if (favoritePendingId) return
    setFavoritePendingId(item.content_id)
    try {
      if (item.is_favorite) {
        await removeFavorite(item.content_id)
      } else {
        await saveFavorite(item.content_id)
      }
      const favorite = !item.is_favorite
      clearMapContentCache()
      setItems((current) => current.map((candidate) => (
        candidate.content_id === item.content_id
          ? { ...candidate, is_favorite: favorite }
          : candidate
      )))
      setSelectedItem((current) => (
        current?.content_id === item.content_id
          ? { ...current, is_favorite: favorite }
          : current
      ))
      setToast(favorite ? '즐겨찾기에 저장했어요.' : '즐겨찾기에서 삭제했어요.')
    } catch {
      setToast('즐겨찾기 상태를 변경하지 못했어요.')
    } finally {
      setFavoritePendingId(null)
    }
  }

  return (
    <main className="app-shell map-page">
      <h1 className="visually-hidden">지도</h1>
      {isRestoringPosition ? (
        <section className="map-state" role="status">
          <strong>현재 위치를 확인하고 있어요</strong>
        </section>
      ) : (
        <KakaoMapCanvas
          center={position ?? DEFAULT_CENTER}
          currentPosition={position}
          items={responseMode === 'CONTENT' ? items : []}
          clusters={clusters}
          selectedContentId={selectedItem?.content_id ?? null}
          mapRef={mapRef}
          onBoundsChange={requestContents}
          onError={setMapError}
          onMapClick={handleMapClick}
          onSelectItem={(item) => {
            setSelectedItem(item)
            setSheetLevel((current) => current === 'collapsed' ? 'default' : current)
          }}
        />
      )}

      <div className="map-controls" aria-label="지도 조작">
        <button type="button" aria-label="확대" onClick={() => changeZoom(-1)}>
          <img src="/assets/map-controls/add.png" alt="" aria-hidden="true" />
        </button>
        <button type="button" aria-label="축소" onClick={() => changeZoom(1)}>
          <img src="/assets/map-controls/minus.png" alt="" aria-hidden="true" />
        </button>
        <button type="button" aria-label="현재 위치로 이동" onClick={() => requestCurrentPosition()}>
          <img src="/assets/map-controls/gps.png" alt="" aria-hidden="true" />
        </button>
      </div>

      {mapError && (
        <section className="map-state" role="alert">
          <strong>지도를 표시하지 못했어요.</strong>
          <p>{mapError}</p>
        </section>
      )}

      <section
        ref={sheetRef}
        className={`map-content-sheet map-content-sheet--${sheetLevel}${sheetDragHeight !== null ? ' map-content-sheet--dragging' : ''}`}
        aria-live="polite"
        style={sheetDragHeight === null ? undefined : { height: `${sheetDragHeight}px` }}
      >
        <button
          type="button"
          className="map-content-sheet__handle-button"
          aria-label={sheetLevel === 'expanded' ? '장소 목록 접기' : '장소 목록 펼치기'}
          aria-expanded={sheetLevel === 'expanded'}
          onClick={() => {
            if (sheetWasDragged.current) {
              sheetWasDragged.current = false
              return
            }
            setSheetLevel((current) => current === 'expanded' ? 'default' : 'expanded')
          }}
          onPointerDown={(event) => {
            sheetWasDragged.current = false
            const measuredHeight = sheetRef.current?.getBoundingClientRect().height ?? 0
            sheetDragStart.current = {
              pointerY: event.clientY,
              height: measuredHeight > 0 ? measuredHeight : sheetHeights()[sheetLevel],
            }
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={(event) => moveSheet(event.clientY)}
          onPointerUp={(event) => finishSheetDrag(
            event.pointerId,
            event.clientY,
            event.currentTarget,
          )}
          onPointerCancel={() => {
            sheetDragStart.current = null
            setSheetDragHeight(null)
          }}
        >
          <span className="map-content-sheet__handle" aria-hidden="true" />
        </button>

        {isContentsLoading && items.length === 0 ? (
          <div className="map-content-sheet__empty">
            <strong>주변 장소와 행사를 찾고 있어요</strong>
          </div>
        ) : contentsError && items.length === 0 ? (
          <div className="map-content-sheet__empty">
            <strong>관광 정보를 불러오지 못했어요</strong>
            <p>지도를 움직여 다시 조회해 주세요.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="map-content-sheet__empty">
            <strong>이 지도 영역에 표시할 장소·행사가 없어요</strong>
            <p>관광 콘텐츠 적재 여부를 확인하거나 다른 지역으로 이동해 주세요.</p>
          </div>
        ) : (
          <div className="map-content-sheet__contents">
            <div className="map-content-sheet__summary">
              <strong>
                {responseMode === 'CLUSTER'
                  ? `현재 화면 장소·행사 ${clusteredContentCount}개 · 주요 ${items.length}개`
                  : `주변 장소·행사 ${items.length}개`}
              </strong>
            </div>
            {sheetLevel === 'expanded' ? (
              <div
                className="map-content-sheet__list"
                role="region"
                aria-label="주변 장소와 행사 목록"
                onScroll={(event) => {
                  const list = event.currentTarget
                  const remaining = list.scrollHeight - list.scrollTop - list.clientHeight
                  if (responseMode === 'CONTENT' && remaining <= 120) {
                    setVisibleSheetItemCount((current) => (
                      Math.min(items.length, current + SHEET_PAGE_SIZE)
                    ))
                  }
                }}
              >
                {visibleSheetItems.map((item) => (
                  <div
                    className={`map-content-sheet__list-item${selectedItem?.content_id === item.content_id ? ' map-content-sheet__list-item--selected' : ''}`}
                    key={item.content_id}
                  >
                    <MapContentCard
                      item={item}
                      favoritePending={favoritePendingId === item.content_id}
                      onSelect={() => {
                        setSelectedItem(item)
                        setSheetLevel('default')
                      }}
                      onToggleFavorite={() => void toggleFavorite(item)}
                    />
                  </div>
                ))}
              </div>
            ) : displayedItem ? (
              <MapContentCard
                item={displayedItem}
                favoritePending={favoritePendingId === displayedItem.content_id}
                onToggleFavorite={() => void toggleFavorite(displayedItem)}
              />
            ) : null}
          </div>
        )}
      </section>

      <BottomNavigation />

      {permissionStep === 'location' && (
        <PermissionModal
          title="현재 위치를 사용해도 될까요?"
          description="가까운 관광지와 행사를 보여드리기 위해 현재 위치가 필요해요. 위치는 이 화면을 이용하는 동안에만 확인합니다."
          confirmLabel="위치 사용하기"
          onConfirm={allowLocation}
          onCancel={skipLocation}
        />
      )}
      {permissionStep === 'notification' && (
        <PermissionModal
          title="여행 알림을 받아볼까요?"
          description="가이드북 생성 완료와 여행 일정 안내를 받을 수 있어요. 실제 웹 푸시 발송은 후속 버전에서 연결됩니다."
          confirmLabel="알림 허용"
          cancelLabel="허용 안 함"
          onConfirm={() => void finishNotification(true)}
          onCancel={() => void finishNotification(false)}
        />
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  )
}
