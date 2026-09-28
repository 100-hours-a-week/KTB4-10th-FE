import { useEffect, useRef } from 'react'
import type { MapBounds, MapContentItem } from '../api/map.ts'
import {
  loadKakaoMaps,
  type KakaoMap,
  type KakaoCluster,
  type KakaoMaps,
  type KakaoMarkerClusterer,
  type KakaoMarker,
} from '../lib/kakaoMaps.ts'
import { pinColor } from '../lib/mapMarkers.ts'

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
  onMapClick: () => void
  onSelectItem: (item: MapContentItem) => void
  mapRef: React.MutableRefObject<KakaoMap | null>
}

function toApiZoom(level: number): number {
  return Math.min(21, Math.max(6, 22 - level))
}

const CLUSTER_KAKAO_LEVEL = 8

function markerImage(maps: KakaoMaps, color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 1C7.7 1 1 7.7 1 16c0 10.5 15 25 15 25s15-14.5 15-25C31 7.7 24.3 1 16 1Z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="5" fill="white"/>
    </svg>`
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  return new maps.MarkerImage(source, new maps.Size(32, 42), {
    offset: new maps.Point(16, 42),
  })
}

export function KakaoMapCanvas({
  center,
  currentPosition,
  items,
  onBoundsChange,
  onError,
  onMapClick,
  onSelectItem,
  mapRef,
}: KakaoMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapsRef = useRef<KakaoMaps | null>(null)
  const contentMarkersRef = useRef<KakaoMarker[]>([])
  const clustererRef = useRef<KakaoMarkerClusterer | null>(null)
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
        map.setMinLevel(1)
        map.setMaxLevel(16)
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
          const zoom = toApiZoom(map.getLevel())
          if (zoom < 13) return
          onBoundsChange({
            south: southWest.getLat(),
            west: southWest.getLng(),
            north: northEast.getLat(),
            east: northEast.getLng(),
            zoom,
            limit: 200,
          })
        }
        maps.event.addListener(map, 'idle', idleHandler)
        maps.event.addListener(map, 'click', onMapClick)
        idleHandler()
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : '지도를 불러오지 못했습니다.')
      })

    return () => {
      disposed = true
      if (mapRef.current && idleHandler && mapsRef.current) {
        mapsRef.current.event.removeListener(mapRef.current, 'idle', idleHandler)
        mapsRef.current.event.removeListener(mapRef.current, 'click', onMapClick)
      }
      clustererRef.current?.clear()
      contentMarkersRef.current.forEach((marker) => marker.setMap(null))
      currentMarkerRef.current?.setMap(null)
      mapRef.current = null
    }
  }, [center.latitude, center.longitude, currentPosition, mapRef, onBoundsChange, onError, onMapClick])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return

    clustererRef.current?.clear()
    contentMarkersRef.current.forEach((marker) => marker.setMap(null))
    contentMarkersRef.current = items.map((item) => {
      const marker = new maps.Marker({
        image: markerImage(maps, pinColor(item)),
        position: new maps.LatLng(item.latitude, item.longitude),
        title: item.title,
      })
      maps.event.addListener(marker, 'click', () => onSelectItem(item))
      return marker
    })

    const clusterer = new maps.MarkerClusterer({
      map,
      markers: contentMarkersRef.current,
      gridSize: 52,
      averageCenter: true,
      minLevel: CLUSTER_KAKAO_LEVEL,
      minClusterSize: 2,
      disableClickZoom: true,
      texts: (size) => size >= 10 ? '9+' : String(size),
      styles: [{
        width: '38px',
        height: '38px',
        border: '2px solid #fff',
        borderRadius: '50%',
        background: '#242428',
        color: '#fff',
        fontSize: '13px',
        fontWeight: '700',
        lineHeight: '34px',
        textAlign: 'center',
        boxShadow: '0 3px 10px rgba(20, 20, 23, 0.22)',
      }],
    })
    const handleClusterClick = (cluster: KakaoCluster) => {
      if (map.getLevel() > CLUSTER_KAKAO_LEVEL) {
        map.setLevel(CLUSTER_KAKAO_LEVEL, { anchor: cluster.getCenter() })
      }
    }
    maps.event.addListener(clusterer, 'clusterclick', handleClusterClick)
    clustererRef.current = clusterer

    return () => {
      maps.event.removeListener(clusterer, 'clusterclick', handleClusterClick)
      clusterer.clear()
    }
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
