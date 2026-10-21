import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

const MAP_MARKERS_PATH = '/api/v1/map/markers'
const MAP_CONTENTS_PATH = '/api/v1/map/contents'
const MAP_CONTENT_CACHE_TTL_MS = 5 * 60 * 1000
const MAP_CONTENT_CACHE_MAX_ENTRIES = 30

export type MapBounds = {
  south: number
  west: number
  north: number
  east: number
  zoom: number
}

export type MapMarkerItem = {
  content_id: string
  title: string
  content_type: 'PLACE' | 'EVENT'
  latitude: number
  longitude: number
  thumbnail_url: string | null
  is_favorite: boolean
  is_in_guidebook: boolean
}

export type MapContentItem = {
  content_id: string
  title: string
  content_type: 'PLACE' | 'EVENT'
  address: string
  latitude: number
  longitude: number
  thumbnail_url: string | null
  event_period: { start_date: string; end_date: string } | null
  is_favorite: boolean
  /** BE 지도 응답 계약에 추가되면 가이드북 포함 장소 핀을 우선 표시한다. */
  is_in_guidebook?: boolean
}

export type MapMarkerResult = {
  mode: 'MARKER' | 'CLUSTER'
  clusters: MapCluster[]
  markers: MapMarkerItem[]
}

export type MapContentPage = {
  items: MapContentItem[]
  next_cursor: string | null
  has_more: boolean
}

export type MapCluster = {
  cluster_id: string
  latitude: number
  longitude: number
  count: number
}

type MapContentCacheEntry = {
  expiresAt: number
  result: MapMarkerResult
}

const mapContentCache = new Map<string, MapContentCacheEntry>()
const pendingMapContentRequests = new Map<string, Promise<MapMarkerResult>>()

function roundedCoordinate(value: number): string {
  return value.toFixed(4)
}

export function mapContentCacheKey(bounds: MapBounds): string {
  return [
    bounds.zoom,
    roundedCoordinate(bounds.south),
    roundedCoordinate(bounds.west),
    roundedCoordinate(bounds.north),
    roundedCoordinate(bounds.east),
  ].join(':')
}

export function clearMapContentCache(): void {
  mapContentCache.clear()
  pendingMapContentRequests.clear()
}

function cacheResult(key: string, result: MapMarkerResult): void {
  if (mapContentCache.size >= MAP_CONTENT_CACHE_MAX_ENTRIES) {
    const oldestKey = mapContentCache.keys().next().value
    if (oldestKey !== undefined) mapContentCache.delete(oldestKey)
  }
  mapContentCache.set(key, {
    expiresAt: Date.now() + MAP_CONTENT_CACHE_TTL_MS,
    result,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMapContentItem(value: unknown): value is MapContentItem {
  if (!isRecord(value)) return false

  return (
    typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    (value.content_type === 'PLACE' || value.content_type === 'EVENT') &&
    typeof value.address === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    (typeof value.thumbnail_url === 'string' || value.thumbnail_url === null) &&
    (value.event_period === null || isRecord(value.event_period)) &&
    typeof value.is_favorite === 'boolean' &&
    (typeof value.is_in_guidebook === 'boolean' || value.is_in_guidebook === undefined)
  )
}

function isMapMarkerItem(value: unknown): value is MapMarkerItem {
  if (!isRecord(value)) return false
  return (
    typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    (value.content_type === 'PLACE' || value.content_type === 'EVENT') &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    (typeof value.thumbnail_url === 'string' || value.thumbnail_url === null) &&
    typeof value.is_favorite === 'boolean' &&
    typeof value.is_in_guidebook === 'boolean'
  )
}

function isMapCluster(value: unknown): value is MapCluster {
  if (!isRecord(value)) return false
  return (
    typeof value.cluster_id === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.count === 'number' &&
    Number.isInteger(value.count) &&
    value.count > 0
  )
}

type Coordinate = {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_KILOMETERS = 6_371

function radians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function distanceKilometers(from: Coordinate, to: Coordinate): number {
  const latitudeDistance = radians(to.latitude - from.latitude)
  const longitudeDistance = radians(to.longitude - from.longitude)
  const fromLatitude = radians(from.latitude)
  const toLatitude = radians(to.latitude)
  const haversine = Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDistance / 2) ** 2
  return 2 * EARTH_RADIUS_KILOMETERS * Math.asin(Math.sqrt(haversine))
}

export function filterContentsWithinRadius(
  items: MapContentItem[],
  center: Coordinate,
  radiusKilometers: number,
): MapContentItem[] {
  return items.filter((item) => distanceKilometers(center, item) <= radiusKilometers)
}

export function filterContentsWithinBounds(
  items: MapContentItem[],
  bounds: Pick<MapBounds, 'south' | 'west' | 'north' | 'east'>,
): MapContentItem[] {
  return items.filter((item) => (
    item.latitude >= bounds.south &&
    item.latitude <= bounds.north &&
    item.longitude >= bounds.west &&
    item.longitude <= bounds.east
  ))
}

export async function getMapMarkers(bounds: MapBounds): Promise<MapMarkerResult> {
  const cacheKey = mapContentCacheKey(bounds)
  const cached = mapContentCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.result
  if (cached) mapContentCache.delete(cacheKey)

  const pending = pendingMapContentRequests.get(cacheKey)
  if (pending) return pending

  const request = http.get<unknown>(MAP_MARKERS_PATH, { params: bounds })
    .then((response) => {
      if (!isApiResponse(response.data) || !isRecord(response.data.data)) {
        throw new Error('지도 콘텐츠 응답 계약이 올바르지 않습니다.')
      }

      const { mode, clusters, markers } = response.data.data
      if (
        (mode !== 'MARKER' && mode !== 'CLUSTER') ||
        !Array.isArray(clusters) ||
        !clusters.every(isMapCluster) ||
        !Array.isArray(markers) ||
        !markers.every(isMapMarkerItem)
      ) {
        throw new Error('지도 마커 응답 계약이 올바르지 않습니다.')
      }

      const result: MapMarkerResult = { mode, clusters, markers }
      cacheResult(cacheKey, result)
      return result
    })
    .finally(() => pendingMapContentRequests.delete(cacheKey))

  pendingMapContentRequests.set(cacheKey, request)
  return request
}

export async function getMapContents(
  bounds: Omit<MapBounds, 'zoom'>,
  cursor: string | null = null,
): Promise<MapContentPage> {
  const response = await http.get<unknown>(MAP_CONTENTS_PATH, {
    params: { ...bounds, cursor: cursor ?? undefined },
  })
  if (!isApiResponse(response.data) || !isRecord(response.data.data)) {
    throw new Error('지도 바텀시트 응답 계약이 올바르지 않습니다.')
  }

  const { items, next_cursor: nextCursor, has_more: hasMore } = response.data.data
  if (
    !Array.isArray(items) ||
    !items.every(isMapContentItem) ||
    (typeof nextCursor !== 'string' && nextCursor !== null) ||
    typeof hasMore !== 'boolean'
  ) {
    throw new Error('지도 바텀시트 응답 계약이 올바르지 않습니다.')
  }
  return { items, next_cursor: nextCursor, has_more: hasMore }
}
