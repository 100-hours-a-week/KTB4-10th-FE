import { useCallback, useEffect, useRef, useState } from 'react'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { Toast } from '../../../shared/ui/Toast.tsx'
import {
  clearMapContentCache,
  getMapContents,
  getMapMarkers,
  type MapBounds,
  type MapCluster,
  type MapContentItem,
  type MapMarkerItem,
} from '../api/map.ts'
import { removeFavorite, saveFavorite } from '../api/favorites.ts'
import { updatePushEnabled } from '../../member/api/memberSettings.ts'
import { notifyRealtimeNotificationSettingChanged } from '../../notification/model/events.ts'
import { enableWebPush, webPushErrorMessage } from '../../notification/model/webPush.ts'
import { getCachedCurrentMember } from '../../auth/api/auth.ts'
import type { KakaoMap } from '../lib/kakaoMaps.ts'
import {
  getMapNavigationState,
  saveMapNavigationState,
  type MapSheetLevel,
  type MapViewport,
} from '../model/mapNavigationState.ts'
import { KakaoMapCanvas } from './KakaoMapCanvas.tsx'
import { PermissionModal } from './PermissionModal.tsx'

const DEFAULT_CENTER = { latitude: 37.3952969470752, longitude: 127.110449292622 }
const LOCATION_PROMPT_KEY = 'kgb.location-prompt-completed'
const NOTIFICATION_PROMPT_KEY = 'kgb.notification-prompt-completed'
const NEXT_PAGE_LOADING_MINIMUM_MS = 350

type PermissionStep = 'location' | 'notification' | null
type SheetLevel = MapSheetLevel
type MapFocusTarget = typeof DEFAULT_CENTER & { requestId: number; level?: number }

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

function markerAsContentItem(marker: MapMarkerItem): MapContentItem {
  return {
    ...marker,
    address: '',
    event_period: null,
  }
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
  const [initialNavigation] = useState(() => {
    const memberId = getCachedCurrentMember()?.member_id ?? null
    return {
      memberId,
      state: memberId === null ? null : getMapNavigationState(memberId),
    }
  })
  const restoredNavigationState = initialNavigation.state
  const mapRef = useRef<KakaoMap | null>(null)
  const viewportRef = useRef<MapViewport | null>(restoredNavigationState?.viewport ?? null)
  const focusRequestIdRef = useRef(0)
  const markerRequestIdRef = useRef(0)
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null)
  const [isRestoringPosition, setIsRestoringPosition] = useState(
    () => !restoredNavigationState && shouldRestoreCurrentPosition(),
  )
  const latestContentRequestRef = useRef(0)
  const currentBoundsRef = useRef<MapBounds | null>(null)
  const sheetLevelRef = useRef<SheetLevel>(restoredNavigationState?.sheetLevel ?? 'collapsed')
  const lastRequestedCursorRef = useRef<string | null>(null)
  const [markers, setMarkers] = useState<MapMarkerItem[]>([])
  const [items, setItems] = useState<MapContentItem[]>([])
  const itemsRef = useRef<MapContentItem[]>([])
  const [clusters, setClusters] = useState<MapCluster[]>([])
  const [responseMode, setResponseMode] = useState<'MARKER' | 'CLUSTER'>('MARKER')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isNextPageLoading, setIsNextPageLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MapContentItem | null>(
    restoredNavigationState?.selectedItem ?? null,
  )
  const selectedItemRef = useRef<MapContentItem | null>(restoredNavigationState?.selectedItem ?? null)
  const [isContentsLoading, setIsContentsLoading] = useState(false)
  const [contentsError, setContentsError] = useState(false)
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>(
    restoredNavigationState?.sheetLevel ?? 'collapsed',
  )
  const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const sheetDragStart = useRef<{ pointerY: number; height: number } | null>(null)
  const sheetWasDragged = useRef(false)
  const [permissionStep, setPermissionStep] = useState<PermissionStep>(initialPermissionStep)
  const [toast, setToast] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null)

  useEffect(() => {
    selectedItemRef.current = selectedItem
  }, [selectedItem])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => () => {
    const { memberId } = initialNavigation
    const viewport = viewportRef.current
    if (memberId === null || !viewport) return

    saveMapNavigationState(memberId, {
      viewport,
      selectedItem: selectedItemRef.current,
      sheetLevel: sheetLevelRef.current,
    })
  }, [initialNavigation])

  const rememberViewport = useCallback((viewport: MapViewport) => {
    viewportRef.current = viewport
  }, [])

  const requestFirstContents = useCallback((bounds: MapBounds) => {
    const requestId = latestContentRequestRef.current + 1
    latestContentRequestRef.current = requestId
    setIsContentsLoading(true)
    setContentsError(false)
    lastRequestedCursorRef.current = null
    getMapContents({
      south: bounds.south,
      west: bounds.west,
      north: bounds.north,
      east: bounds.east,
    })
      .then((contentPage) => {
        if (requestId !== latestContentRequestRef.current) return
        setItems(contentPage.items)
        setSelectedItem((current) => current
          ? contentPage.items.find((item) => item.content_id === current.content_id) ?? current
          : current)
        setNextCursor(contentPage.next_cursor)
        setHasMore(contentPage.has_more)
        setIsNextPageLoading(false)
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

  const requestMapData = useCallback((bounds: MapBounds) => {
    const requestId = markerRequestIdRef.current + 1
    markerRequestIdRef.current = requestId
    currentBoundsRef.current = bounds
    latestContentRequestRef.current += 1
    lastRequestedCursorRef.current = null
    itemsRef.current = []
    setItems([])
    setNextCursor(null)
    setHasMore(false)
    setIsNextPageLoading(false)

    getMapMarkers(bounds)
      .then((result) => {
        if (requestId !== markerRequestIdRef.current) return
        setMarkers(result.markers)
        setClusters(result.clusters)
        setResponseMode(result.mode)
      })
      .catch(() => {
        if (requestId !== markerRequestIdRef.current) return
        setToast('지도 표시 정보를 불러오지 못했어요.')
      })

    if (sheetLevelRef.current !== 'collapsed') {
      requestFirstContents(bounds)
    } else {
      setIsContentsLoading(false)
      setContentsError(false)
    }
  }, [requestFirstContents])

  const changeSheetLevel = useCallback((level: SheetLevel) => {
    sheetLevelRef.current = level
    setSheetLevel(level)
    if (level !== 'collapsed' && currentBoundsRef.current && itemsRef.current.length === 0) {
      requestFirstContents(currentBoundsRef.current)
    }
  }, [requestFirstContents])

  const requestNextContents = useCallback(() => {
    const bounds = currentBoundsRef.current
    if (!bounds || !hasMore || !nextCursor || isNextPageLoading) return
    if (lastRequestedCursorRef.current === nextCursor) return

    const requestId = latestContentRequestRef.current
    const requestedCursor = nextCursor
    lastRequestedCursorRef.current = requestedCursor
    setIsNextPageLoading(true)
    const startedAt = performance.now()
    getMapContents({
      south: bounds.south,
      west: bounds.west,
      north: bounds.north,
      east: bounds.east,
    }, requestedCursor)
      .then(async (page) => {
        const remainingDelay = NEXT_PAGE_LOADING_MINIMUM_MS - (performance.now() - startedAt)
        if (remainingDelay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remainingDelay))
        }
        if (requestId !== latestContentRequestRef.current) return
        setItems((current) => {
          const merged = new Map(current.map((item) => [item.content_id, item]))
          page.items.forEach((item) => merged.set(item.content_id, item))
          return [...merged.values()]
        })
        setNextCursor(page.next_cursor)
        setHasMore(page.has_more)
      })
      .catch(() => {
        if (requestId !== latestContentRequestRef.current) return
        lastRequestedCursorRef.current = null
        setToast('다음 관광 정보를 불러오지 못했어요.')
      })
      .finally(() => {
        if (requestId === latestContentRequestRef.current) setIsNextPageLoading(false)
      })
  }, [hasMore, isNextPageLoading, nextCursor])

  const focusKakaoHeadquarters = useCallback(() => {
    focusRequestIdRef.current += 1
    setFocusTarget({ ...DEFAULT_CENTER, requestId: focusRequestIdRef.current })
  }, [])

  const requestCurrentPosition = useCallback((afterRequest?: () => void) => {
    if (!navigator.geolocation) {
      focusKakaoHeadquarters()
      setToast('위치 권한이 없어 카카오 본사 인근을 보여드릴게요.')
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
        focusKakaoHeadquarters()
        setToast('위치 권한이 없어 카카오 본사 인근을 보여드릴게요.')
        afterRequest?.()
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [focusKakaoHeadquarters])

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
    focusKakaoHeadquarters()
    setToast('위치 권한이 없어 카카오 본사 인근을 보여드릴게요.')
    continueToNotification()
  }

  const finishNotification = async (allow: boolean) => {
    localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
    setPermissionStep(null)

    try {
      if (allow) await enableWebPush()
      const settings = await updatePushEnabled(allow)
      notifyRealtimeNotificationSettingChanged(settings.push_enabled)
    } catch (error) {
      setToast(allow
        ? webPushErrorMessage(error)
        : '알림 설정은 마이페이지에서 다시 변경할 수 있어요.')
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
    changeSheetLevel(nextLevel)
    setSheetDragHeight(null)
    sheetDragStart.current = null
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId)
  }

  const displayedItem = selectedItem
    ? items.find((item) => item.content_id === selectedItem.content_id) ?? selectedItem
    : items[0] ?? (responseMode === 'MARKER' && markers[0]
      ? markerAsContentItem(markers[0])
      : null)
  const clusteredContentCount = clusters.reduce((total, cluster) => total + cluster.count, 0)
  const visibleMapContentCount = responseMode === 'CLUSTER'
    ? clusteredContentCount
    : markers.length
  const handleMapClick = useCallback(() => {
    setSelectedItem(null)
    changeSheetLevel(sheetLevelRef.current === 'expanded' ? 'default' : 'collapsed')
    setSheetDragHeight(null)
  }, [changeSheetLevel])

  const selectMapItem = useCallback((item: MapMarkerItem) => {
    setSelectedItem(
      itemsRef.current.find((candidate) => candidate.content_id === item.content_id) ??
      markerAsContentItem(item),
    )
    changeSheetLevel('default')
  }, [changeSheetLevel])

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
          center={restoredNavigationState?.viewport.center ?? position ?? DEFAULT_CENTER}
          initialLevel={restoredNavigationState?.viewport.level}
          currentPosition={position}
          focusTarget={focusTarget}
          items={responseMode === 'MARKER' ? markers : []}
          clusters={clusters}
          selectedContentId={selectedItem?.content_id ?? null}
          mapRef={mapRef}
          onBoundsChange={requestMapData}
          onViewportChange={rememberViewport}
          onError={setMapError}
          onMapClick={handleMapClick}
          onSelectItem={selectMapItem}
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
            changeSheetLevel(sheetLevel === 'expanded' ? 'default' : 'expanded')
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

        {isContentsLoading && items.length === 0 && sheetLevel === 'expanded' ? (
          <div className="map-content-sheet__empty">
            <strong>주변 장소와 행사를 찾고 있어요</strong>
          </div>
        ) : contentsError && items.length === 0 && !selectedItem && sheetLevel === 'expanded' ? (
          <div className="map-content-sheet__empty">
            <strong>관광 정보를 불러오지 못했어요</strong>
            <p>지도를 움직여 다시 조회해 주세요.</p>
          </div>
        ) : items.length === 0 && visibleMapContentCount === 0 && !selectedItem ? (
          <div className="map-content-sheet__empty">
            <strong>이 지도 영역에 표시할 장소·행사가 없어요</strong>
            <p>관광 콘텐츠 적재 여부를 확인하거나 다른 지역으로 이동해 주세요.</p>
          </div>
        ) : (
          <div className="map-content-sheet__contents">
            <div className="map-content-sheet__summary">
              <strong>
                {responseMode === 'CLUSTER'
                  ? `현재 화면 장소·행사 ${visibleMapContentCount}개`
                  : `주변 장소·행사 ${visibleMapContentCount}개`}
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
                  if (remaining <= 1) requestNextContents()
                }}
              >
                {items.map((item) => (
                  <div
                    className={`map-content-sheet__list-item${selectedItem?.content_id === item.content_id ? ' map-content-sheet__list-item--selected' : ''}`}
                    key={item.content_id}
                  >
                    <MapContentCard
                      item={item}
                      favoritePending={favoritePendingId === item.content_id}
                      onSelect={() => {
                        setSelectedItem(item)
                        focusRequestIdRef.current += 1
                        setFocusTarget({
                          latitude: item.latitude,
                          longitude: item.longitude,
                          requestId: focusRequestIdRef.current,
                          level: 5,
                        })
                        changeSheetLevel('default')
                      }}
                      onToggleFavorite={() => void toggleFavorite(item)}
                    />
                  </div>
                ))}
                {isNextPageLoading && (
                  <div className="map-content-sheet__page-loader" role="status">
                    <span aria-hidden="true" />
                    <strong>다음 10개를 펼치고 있어요</strong>
                  </div>
                )}
                {!hasMore && items.length > 0 && (
                  <p className="map-content-sheet__list-end">
                    현재 영역의 장소와 행사를 모두 확인했어요
                  </p>
                )}
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
          description="가이드북 생성 완료와 여행 일정 안내를 받을 수 있어요."
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
