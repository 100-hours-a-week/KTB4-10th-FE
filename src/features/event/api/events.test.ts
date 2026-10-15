import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '../../../shared/api/http.ts'
import { getEvents, getNewEvents, seoulYesterday } from './events.ts'

vi.mock('../../../shared/api/http.ts', () => ({
  http: { get: vi.fn() },
}))

describe('event API', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('서울 기준 전날을 신규 행사 조회일로 사용한다', () => {
    expect(seoulYesterday(Date.parse('2026-10-15T03:00:00Z'))).toBe('2026-10-14')
  })

  it('전날 신규 행사 목록을 요청한다', async () => {
    vi.useFakeTimers()
    vi.mocked(http.get).mockResolvedValue({
      data: {
        message: 'new_event_list_success',
        data: {
          date: '2026-10-14',
          items: [],
          page: 1,
          size: 20,
          total_items: 0,
          total_pages: 0,
        },
      },
    })
    vi.setSystemTime(new Date('2026-10-15T03:00:00Z'))

    await getNewEvents()

    expect(http.get).toHaveBeenCalledWith('/api/v1/events/new', {
      params: { date: '2026-10-14', page: 1, size: 20 },
      signal: undefined,
    })
  })

  it('선택한 행사 목록 페이지를 요청한다', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        message: 'content_list_success',
        data: { items: [], page: 3, size: 20, total_items: 0, total_pages: 0 },
      },
    })

    await getEvents('야행', 3)

    expect(http.get).toHaveBeenCalledWith('/api/v1/contents', {
      params: { category: 'EVENT', page: 3, size: 10, q: '야행' },
      signal: undefined,
    })
  })
})
