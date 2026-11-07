import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

const CONTENT_SEARCH_PATH = '/api/v1/contents'

export type MapSearchContent = {
  content_id: string
  title: string
  content_type: 'PLACE' | 'EVENT'
  region: { administrative_code: string; name: string } | null
  address: string | null
  latitude: number
  longitude: number
  thumbnail_url: string | null
  event_period: { start_date: string; end_date: string } | null
  is_favorite: boolean
  is_in_guidebook: boolean
}

export type MapSearchResult = {
  items: MapSearchContent[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isMapSearchContent(value: unknown): value is MapSearchContent {
  return isRecord(value) &&
    typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    (value.content_type === 'PLACE' || value.content_type === 'EVENT') &&
    (value.region === null || isRecord(value.region)) &&
    isNullableString(value.address) &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    isNullableString(value.thumbnail_url) &&
    (value.event_period === null || isRecord(value.event_period)) &&
    typeof value.is_favorite === 'boolean' &&
    typeof value.is_in_guidebook === 'boolean'
}

function isMapSearchResult(value: unknown): value is MapSearchResult {
  return isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isMapSearchContent) &&
    typeof value.page === 'number' &&
    typeof value.size === 'number' &&
    typeof value.total_items === 'number' &&
    typeof value.total_pages === 'number'
}

export async function searchMapContents(
  query: string,
  signal?: AbortSignal,
): Promise<MapSearchResult> {
  const normalizedQuery = query.trim().slice(0, 10)
  if (!normalizedQuery) {
    return { items: [], page: 1, size: 20, total_items: 0, total_pages: 0 }
  }

  const response = await http.get<unknown>(CONTENT_SEARCH_PATH, {
    params: { category: 'ALL', q: normalizedQuery, page: 1, size: 20 },
    signal,
  })
  if (!isApiResponse(response.data) || !isMapSearchResult(response.data.data)) {
    throw new Error('지도 검색 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}
