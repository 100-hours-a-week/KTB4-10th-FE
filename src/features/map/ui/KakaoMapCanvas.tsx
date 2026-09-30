import { useEffect, useRef } from 'react'
import type { MapBounds, MapCluster, MapContentItem } from '../api/map.ts'
import {
  loadKakaoMaps,
  type KakaoMap,
  type KakaoCluster,
  type KakaoMaps,
  type KakaoMarkerClusterer,
  type KakaoMarker,
} from '../lib/kakaoMaps.ts'
import { clusterLabel, pinColor, serverClusterStyle } from '../lib/mapMarkers.ts'

type Coordinate = {
  latitude: number
  longitude: number
}

type KakaoMapCanvasProps = {
  center: Coordinate
  currentPosition: Coordinate | null
  items: MapContentItem[]
  clusters: MapCluster[]
  selectedContentId: string | null
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

function markerImage(maps: KakaoMaps, color: string, selected: boolean) {
  const width = selected ? 38 : 32
  const height = selected ? 50 : 42
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 32 42">
      <path d="M16 1C7.7 1 1 7.7 1 16c0 10.5 15 25 15 25s15-14.5 15-25C31 7.7 24.3 1 16 1Z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="5" fill="white"/>
    </svg>`
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  return new maps.MarkerImage(source, new maps.Size(width, height), {
    offset: new maps.Point(width / 2, height),
  })
}

function clusterImage(maps: KakaoMaps, count: number, level: number) {
  const label = clusterLabel(count)
  const { size, fontSize, fillOpacity } = serverClusterStyle(level, count)
  const center = size / 2
  const radius = center - 1.5
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${radius}"
        fill="#242428" fill-opacity="${fillOpacity}"
        stroke="white" stroke-opacity="0.88" stroke-width="1.5"/>
      <text x="${center}" y="${center + 1}" fill="white" font-size="${fontSize}" font-weight="700"
        text-anchor="middle" dominant-baseline="middle">${label}</text>
    </svg>`
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  return new maps.MarkerImage(source, new maps.Size(size, size), {
    offset: new maps.Point(center, center),
  })
}

export function KakaoMapCanvas({
  center,
  currentPosition,
  items,
  clusters,
  selectedContentId,
  onBoundsChange,
  onError,
  onMapClick,
  onSelectItem,
  mapRef,
}: KakaoMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialCenterRef = useRef(center)
  const mapsRef = useRef<KakaoMaps | null>(null)
  const contentMarkersRef = useRef<KakaoMarker[]>([])
  const serverClusterMarkersRef = useRef<KakaoMarker[]>([])
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
          center: new maps.LatLng(
            initialCenterRef.current.latitude,
            initialCenterRef.current.longitude,
          ),
          level: 5,
        })
        mapRef.current = map
        map.setMinLevel(1)
        map.setMaxLevel(16)
        idleHandler = () => {
          const bounds = map.getBounds()
          const southWest = bounds.getSouthWest()
          const northEast = bounds.getNorthEast()
          const zoom = toApiZoom(map.getLevel())
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
      serverClusterMarkersRef.current.forEach((marker) => marker.setMap(null))
      currentMarkerRef.current?.setMap(null)
      mapRef.current = null
    }
  }, [mapRef, onBoundsChange, onError, onMapClick])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return

    clustererRef.current?.clear()
    contentMarkersRef.current.forEach((marker) => marker.setMap(null))
    contentMarkersRef.current = items.map((item) => {
      const marker = new maps.Marker({
        image: markerImage(
          maps,
          item.content_id === selectedContentId ? '#2478ff' : pinColor(item),
          item.content_id === selectedContentId,
        ),
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
      texts: clusterLabel,
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
  }, [items, mapRef, onSelectItem, selectedContentId])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return

    serverClusterMarkersRef.current.forEach((marker) => marker.setMap(null))
    const level = map.getLevel()
    serverClusterMarkersRef.current = clusters.map((cluster) => {
      const position = new maps.LatLng(cluster.latitude, cluster.longitude)
      const marker = new maps.Marker({
        map,
        image: clusterImage(maps, cluster.count, level),
        position,
        title: `콘텐츠 ${cluster.count}개`,
      })
      maps.event.addListener(marker, 'click', () => {
        map.setLevel(7, { anchor: position })
      })
      return marker
    })

    return () => {
      serverClusterMarkersRef.current.forEach((marker) => marker.setMap(null))
      serverClusterMarkersRef.current = []
    }
  }, [clusters, mapRef])

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
    const nextCenter = new maps.LatLng(currentPosition.latitude, currentPosition.longitude)
    map.panTo(nextCenter)
  }, [currentPosition, mapRef])

  return <div className="map-canvas" ref={containerRef} aria-label="현재 위치 주변 관광 지도" />
}
