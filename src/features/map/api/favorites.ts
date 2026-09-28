import { ensureCsrfToken, requestWithCsrf } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'

export type FavoriteContentResponse = {
  content_id: string
  is_favorite: boolean
}

function favoritePath(contentId: string): string {
  return `/api/v1/members/me/favorites/${encodeURIComponent(contentId)}`
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
