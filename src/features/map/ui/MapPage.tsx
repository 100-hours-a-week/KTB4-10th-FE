import { useCallback, useRef, useState } from 'react'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { Toast } from '../../../shared/ui/Toast.tsx'
import { getMapContents, type MapBounds, type MapContentItem } from '../api/map.ts'
import { updatePushEnabled } from '../api/settings.ts'
import type { KakaoMap } from '../lib/kakaoMaps.ts'
import { KakaoMapCanvas } from './KakaoMapCanvas.tsx'
import { PermissionModal } from './PermissionModal.tsx'

const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 }
const LOCATION_PROMPT_KEY = 'kgb.location-prompt-completed'
const NOTIFICATION_PROMPT_KEY = 'kgb.notification-prompt-completed'

type PermissionStep = 'location' | 'notification' | null

function initialPermissionStep(): PermissionStep {
  return localStorage.getItem(LOCATION_PROMPT_KEY) ? null : 'location'
}

function eventPeriodText(item: MapContentItem): string | null {
  if (!item.event_period) return null
  return `${item.event_period.start_date} ~ ${item.event_period.end_date}`
}

function MapContentCard({ item }: { item: MapContentItem }) {
  return (
    <article className="map-content-card">
      <div className="map-content-card__thumbnail">
        {item.thumbnail_url
          ? <img src={item.thumbnail_url} alt="" />
          : <span aria-hidden="true">{item.content_type === 'EVENT' ? '행사' : '장소'}</span>}
      </div>
      <div className="map-content-card__body">
        <span>{item.content_type === 'EVENT' ? '행사' : '관광지'}</span>
        <h2>{item.title}</h2>
        <p>{eventPeriodText(item) ?? item.address}</p>
      </div>
    </article>
  )
}

export function MapPage() {
  const mapRef = useRef<KakaoMap | null>(null)
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [items, setItems] = useState<MapContentItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MapContentItem | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isContentsLoading, setIsContentsLoading] = useState(false)
  const [contentsError, setContentsError] = useState(false)
  const [isSheetExpanded, setIsSheetExpanded] = useState(false)
  const sheetPointerStartY = useRef<number | null>(null)
  const [permissionStep, setPermissionStep] = useState<PermissionStep>(initialPermissionStep)
  const [toast, setToast] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const requestContents = useCallback((bounds: MapBounds) => {
    setIsContentsLoading(true)
    setContentsError(false)
    getMapContents(bounds)
      .then((result) => {
        setItems(result.items)
        setHasMore(result.has_more)
        setSelectedItem((current) => (
          current && result.items.some((item) => item.content_id === current.content_id)
            ? current
            : null
        ))
      })
      .catch(() => {
        setContentsError(true)
        setToast('주변 관광 정보를 불러오지 못했어요.')
      })
      .finally(() => setIsContentsLoading(false))
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
    map.setLevel(Math.min(6, Math.max(1, map.getLevel() + difference)), {
      anchor: map.getCenter(),
    })
  }

  const finishSheetDrag = (clientY: number) => {
    if (sheetPointerStartY.current === null) return
    const movement = clientY - sheetPointerStartY.current
    if (movement <= -30) setIsSheetExpanded(true)
    if (movement >= 30) setIsSheetExpanded(false)
    sheetPointerStartY.current = null
  }

  const displayedItem = selectedItem ?? items[0] ?? null

  return (
    <main className="app-shell map-page">
      <h1 className="visually-hidden">지도</h1>
      <KakaoMapCanvas
        center={position ?? DEFAULT_CENTER}
        currentPosition={position}
        items={items}
        mapRef={mapRef}
        onBoundsChange={requestContents}
        onError={setMapError}
        onSelectItem={setSelectedItem}
      />

      <div className="map-controls" aria-label="지도 조작">
        <button type="button" aria-label="확대" onClick={() => changeZoom(-1)}>＋</button>
        <button type="button" aria-label="축소" onClick={() => changeZoom(1)}>－</button>
        <button type="button" aria-label="현재 위치로 이동" onClick={() => requestCurrentPosition()}>⌖</button>
      </div>

      {mapError && (
        <section className="map-state" role="alert">
          <strong>지도를 표시하지 못했어요.</strong>
          <p>{mapError}</p>
        </section>
      )}

      <section
        className={`map-content-sheet${isSheetExpanded ? ' map-content-sheet--expanded' : ''}`}
        aria-live="polite"
      >
        <button
          type="button"
          className="map-content-sheet__handle-button"
          aria-label={isSheetExpanded ? '장소 목록 접기' : '장소 목록 펼치기'}
          aria-expanded={isSheetExpanded}
          onClick={() => setIsSheetExpanded((expanded) => !expanded)}
          onPointerDown={(event) => { sheetPointerStartY.current = event.clientY }}
          onPointerUp={(event) => finishSheetDrag(event.clientY)}
          onPointerCancel={() => { sheetPointerStartY.current = null }}
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
              <strong>주변 장소·행사 {items.length}개</strong>
              {hasMore && <small>지도를 확대하면 더 많은 장소를 확인할 수 있어요.</small>}
            </div>
            {isSheetExpanded ? (
              <div className="map-content-sheet__list" aria-label="주변 장소와 행사 목록">
                {items.map((item) => (
                  <button
                    type="button"
                    className={`map-content-sheet__list-item${selectedItem?.content_id === item.content_id ? ' map-content-sheet__list-item--selected' : ''}`}
                    key={item.content_id}
                    onClick={() => {
                      setSelectedItem(item)
                      setIsSheetExpanded(false)
                    }}
                  >
                    <MapContentCard item={item} />
                  </button>
                ))}
              </div>
            ) : displayedItem ? <MapContentCard item={displayedItem} /> : null}
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
