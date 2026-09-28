import { useEffect, useRef } from 'react'
import type { MapBounds, MapContentItem } from '../api/map.ts'
import {
  loadKakaoMaps,
  type KakaoMap,
  type KakaoMaps,
  type KakaoMarker,
} from '../lib/kakaoMaps.ts'

type Coordinate = {
  latitude: number
  longitude: number
}

type KakaoMapCanvasProps = {
  center: Coordinate
  currentPosition: Coordinate | null
  items: MapContentItem[]
  onBoundsChange: (bounds: MapBounds) => void
  onError: (message: string) => void
  onSelectItem: (item: MapContentItem) => void
  mapRef: React.MutableRefObject<KakaoMap | null>
}

function toApiZoom(level: number): number {
  return Math.min(21, Math.max(6, 22 - level))
}

export function KakaoMapCanvas({
  center,
  currentPosition,
  items,
  onBoundsChange,
  onError,
  onSelectItem,
  mapRef,
}: KakaoMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapsRef = useRef<KakaoMaps | null>(null)
  const contentMarkersRef = useRef<KakaoMarker[]>([])
  const currentMarkerRef = useRef<KakaoMarker | null>(null)

  useEffect(() => {
    let disposed = false
    let idleHandler: (() => void) | null = null

    loadKakaoMaps()
      .then((maps) => {
        if (disposed || !containerRef.current) return
        mapsRef.current = maps
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center.latitude, center.longitude),
          level: 4,
        })
        mapRef.current = map
        if (currentPosition) {
          currentMarkerRef.current = new maps.Marker({
            map,
            position: new maps.LatLng(currentPosition.latitude, currentPosition.longitude),
            title: '현재 위치',
          })
        }
        idleHandler = () => {
          const bounds = map.getBounds()
          const southWest = bounds.getSouthWest()
          const northEast = bounds.getNorthEast()
          onBoundsChange({
            south: southWest.getLat(),
            west: southWest.getLng(),
            north: northEast.getLat(),
            east: northEast.getLng(),
            zoom: toApiZoom(map.getLevel()),
            limit: 100,
          })
        }
        maps.event.addListener(map, 'idle', idleHandler)
        idleHandler()
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : '지도를 불러오지 못했습니다.')
      })

    return () => {
      disposed = true
      if (mapRef.current && idleHandler && mapsRef.current) {
        mapsRef.current.event.removeListener(mapRef.current, 'idle', idleHandler)
      }
      contentMarkersRef.current.forEach((marker) => marker.setMap(null))
      currentMarkerRef.current?.setMap(null)
      mapRef.current = null
    }
  }, [center.latitude, center.longitude, currentPosition, mapRef, onBoundsChange, onError])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return

    contentMarkersRef.current.forEach((marker) => marker.setMap(null))
    contentMarkersRef.current = items.map((item) => {
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(item.latitude, item.longitude),
        title: item.title,
      })
      maps.event.addListener(marker, 'click', () => onSelectItem(item))
      return marker
    })
  }, [items, mapRef, onSelectItem])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map || !currentPosition) return

    currentMarkerRef.current?.setMap(null)
    currentMarkerRef.current = new maps.Marker({
      map,
      position: new maps.LatLng(currentPosition.latitude, currentPosition.longitude),
      title: '현재 위치',
    })
    map.panTo(new maps.LatLng(currentPosition.latitude, currentPosition.longitude))
  }, [currentPosition, mapRef])

  return <div className="map-canvas" ref={containerRef} aria-label="현재 위치 주변 관광 지도" />
}
