import { describe, expect, it } from 'vitest'
import {
  EVENT_REGION_OPTIONS,
  eventFiltersToSearchParams,
  readEventFilters,
} from './eventFilters.ts'

describe('event filters', () => {
  it('세종 서비스 권역은 실제 PROVINCE 코드 36110을 사용한다', () => {
    expect(EVENT_REGION_OPTIONS.find(({ label }) => label === '세종'))
      .toEqual({ code: '36110', label: '세종' })

    const filters = readEventFilters(new URLSearchParams('region_code=36110'))
    expect(filters.regionCode).toBe('36110')
    expect(eventFiltersToSearchParams(filters).get('region_code')).toBe('36110')
  })

  it('신규 행사 보기 상태를 query로 저장하고 복구한다', () => {
    const filters = readEventFilters(new URLSearchParams('view=new'))

    expect(filters.view).toBe('new')
    expect(eventFiltersToSearchParams(filters).toString()).toBe('view=new')
    expect(readEventFilters(new URLSearchParams('view=unknown')).view).toBe('all')
  })

  it('알림이 지정한 기준일의 신규 행사 보기 상태를 복구한다', () => {
    const filters = readEventFilters(new URLSearchParams('view=new&date=2026-11-02'))

    expect(filters.view).toBe('new')
    expect(filters.date).toBe('2026-11-02')
    expect(eventFiltersToSearchParams(filters).toString()).toBe('view=new&date=2026-11-02')
  })

  it('실제로 존재하지 않는 기준일은 전체 행사 보기로 안전하게 복구한다', () => {
    const filters = readEventFilters(new URLSearchParams('view=new&date=2026-02-30'))

    expect(filters.view).toBe('all')
    expect(filters.date).toBe('')
    expect(eventFiltersToSearchParams(filters).toString()).toBe('')
  })
})
