import { ensureCsrfToken, requestWithCsrf } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

export type FavoriteContentResponse = {
  content_id: string
  is_favorite: boolean
}

export type FavoriteListItem = {
  content_id: string
  title: string
  content_type: 'PLACE' | 'EVENT'
  address: string | null
  thumbnail_url: string | null
  event_period: { start_date: string | null; end_date: string | null } | null
  is_favorite: boolean
}

export type FavoriteListPage = {
  items: FavoriteListItem[]
  next_cursor: string | null
  has_more: boolean
}

const FAVORITES_PATH = '/api/v1/members/me/favorites'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isFavoriteListItem(value: unknown): value is FavoriteListItem {
  if (!isRecord(value)) return false
  const period = value.event_period
  return typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    (value.content_type === 'PLACE' || value.content_type === 'EVENT') &&
    isNullableString(value.address) &&
    isNullableString(value.thumbnail_url) &&
    (period === null || (isRecord(period) &&
      isNullableString(period.start_date) && isNullableString(period.end_date))) &&
    typeof value.is_favorite === 'boolean'
}

function isFavoriteListPage(value: unknown): value is FavoriteListPage {
  return isRecord(value) &&
    Array.isArray(value.items) && value.items.every(isFavoriteListItem) &&
    isNullableString(value.next_cursor) && typeof value.has_more === 'boolean'
}

function favoritePath(contentId: string): string {
  return `/api/v1/members/me/favorites/${encodeURIComponent(contentId)}`
}

export async function listFavorites(
  cursor?: string,
  signal?: AbortSignal,
): Promise<FavoriteListPage> {
  const response = await http.get<unknown>(FAVORITES_PATH, {
    params: { size: 20, ...(cursor ? { cursor } : {}) },
    signal,
  })
  if (!isApiResponse(response.data) || !isFavoriteListPage(response.data.data)) {
    throw new Error('즐겨찾기 목록 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}

export async function saveFavorite(contentId: string): Promise<FavoriteContentResponse> {
  const response = await requestWithCsrf<FavoriteContentResponse>({
    method: 'put',
    url: favoritePath(contentId),
  })
  return response.data
}

export async function removeFavorite(contentId: string): Promise<void> {
  await ensureCsrfToken()
  await http.delete(favoritePath(contentId))
}
