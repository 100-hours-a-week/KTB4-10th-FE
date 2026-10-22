import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFavorites, removeFavorite, saveFavorite } from './favorites.ts'

const { deleteMock, getMock, ensureCsrfTokenMock, requestWithCsrfMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  ensureCsrfTokenMock: vi.fn(),
  requestWithCsrfMock: vi.fn(),
}))

vi.mock('../../../shared/api/csrf.ts', () => ({
  ensureCsrfToken: ensureCsrfTokenMock,
  requestWithCsrf: requestWithCsrfMock,
}))

vi.mock('../../../shared/api/http.ts', () => ({
  http: { delete: deleteMock, get: getMock },
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

  it('최근 추가 순서의 즐겨찾기 목록을 커서로 조회한다', async () => {
    getMock.mockResolvedValue({ data: {
      message: 'favorite_list_success',
      data: {
        items: [{
          content_id: 'event-1', title: '가을 축제', content_type: 'EVENT',
          address: '서울', thumbnail_url: null,
          event_period: { start_date: '2026-10-24', end_date: '2026-10-25' },
          is_favorite: true,
        }],
        next_cursor: 'next', has_more: true,
      },
    } })

    await expect(listFavorites('cursor')).resolves.toMatchObject({ has_more: true })
    expect(getMock).toHaveBeenCalledWith('/api/v1/members/me/favorites', {
      params: { size: 20, cursor: 'cursor' },
      signal: undefined,
    })
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
