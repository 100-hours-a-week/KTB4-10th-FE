import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeFavorite, saveFavorite } from './favorites.ts'

const { deleteMock, ensureCsrfTokenMock, requestWithCsrfMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  ensureCsrfTokenMock: vi.fn(),
  requestWithCsrfMock: vi.fn(),
}))

vi.mock('../../../shared/api/csrf.ts', () => ({
  ensureCsrfToken: ensureCsrfTokenMock,
  requestWithCsrf: requestWithCsrfMock,
}))

vi.mock('../../../shared/api/http.ts', () => ({
  http: { delete: deleteMock },
}))

describe('즐겨찾기 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureCsrfTokenMock.mockResolvedValue({
      cookie_name: 'XSRF-TOKEN',
      header_name: 'X-XSRF-TOKEN',
    })
    deleteMock.mockResolvedValue({ status: 204 })
  })

  it('알고 있는 콘텐츠 URI를 PUT으로 저장한다', async () => {
    requestWithCsrfMock.mockResolvedValue({
      message: 'favorite_saved',
      data: { content_id: 'content/1', is_favorite: true },
    })

    await expect(saveFavorite('content/1')).resolves.toEqual({
      content_id: 'content/1',
      is_favorite: true,
    })
    expect(requestWithCsrfMock).toHaveBeenCalledWith({
      method: 'put',
      url: '/api/v1/members/me/favorites/content%2F1',
    })
  })

  it('CSRF 초기화 후 DELETE로 즐겨찾기를 해제한다', async () => {
    await removeFavorite('content-1')

    expect(ensureCsrfTokenMock).toHaveBeenCalledOnce()
    expect(deleteMock).toHaveBeenCalledWith('/api/v1/members/me/favorites/content-1')
  })
})
