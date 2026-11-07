import { describe, expect, it, vi } from 'vitest'
import { http } from '../../../shared/api/http.ts'
import { searchMapContents } from './search.ts'

vi.mock('../../../shared/api/http.ts', () => ({
  http: { get: vi.fn() },
}))

describe('searchMapContents', () => {
  it('검색어를 정규화해 통합 검색하고 개인화 필드를 반환한다', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        message: 'content_list_success',
        data: {
          items: [{
            content_id: 'event-1',
            title: '서울 축제',
            content_type: 'EVENT',
            region: { administrative_code: '11', name: '서울특별시' },
            address: '서울 중구',
            latitude: 37.5665,
            longitude: 126.978,
            thumbnail_url: null,
            event_period: { start_date: '2026-11-01', end_date: '2026-11-30' },
            is_favorite: true,
            is_in_guidebook: false,
          }],
          page: 1,
          size: 20,
          total_items: 1,
          total_pages: 1,
        },
      },
    })

    const result = await searchMapContents('  서울 축제  ')

    expect(http.get).toHaveBeenCalledWith('/api/v1/contents', {
      params: { category: 'ALL', q: '서울 축제', page: 1, size: 20 },
      signal: undefined,
    })
    expect(result.items[0]).toMatchObject({
      content_id: 'event-1',
      is_favorite: true,
    })
  })

  it('공백 검색은 API를 호출하지 않는다', async () => {
    const result = await searchMapContents('   ')
    expect(http.get).not.toHaveBeenCalled()
    expect(result.items).toEqual([])
  })
})
