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
})
