import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

const MAP_CONTENTS_PATH = '/api/v1/map/contents'

export type MapBounds = {
  south: number
  west: number
  north: number
  east: number
  zoom: number
  limit?: number
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

export type MapContentResult = {
  items: MapContentItem[]
  has_more: boolean
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

export async function getMapContents(bounds: MapBounds): Promise<MapContentResult> {
  const response = await http.get<unknown>(MAP_CONTENTS_PATH, { params: bounds })
  if (!isApiResponse(response.data) || !isRecord(response.data.data)) {
    throw new Error('지도 콘텐츠 응답 계약이 올바르지 않습니다.')
  }

  const { items, has_more: hasMore } = response.data.data
  if (!Array.isArray(items) || !items.every(isMapContentItem) || typeof hasMore !== 'boolean') {
    throw new Error('지도 콘텐츠 응답 계약이 올바르지 않습니다.')
  }

  return { items, has_more: hasMore }
}
