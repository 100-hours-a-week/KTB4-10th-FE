import { describe, expect, it } from 'vitest'
import { dayOffset, yearLimit } from './conditions.ts'

describe('여행 날짜 경계', () => {
  it('월·연도 경계를 넘어도 최대 7일을 계산한다', () => {
    expect(dayOffset('2026-12-29', 6)).toBe('2027-01-04')
    expect(dayOffset('2028-02-27', 2)).toBe('2028-02-29')
  })
  it('윤년의 1년 후는 백엔드 LocalDate.plusYears와 동일하게 계산한다', () => {
    expect(yearLimit('2028-02-29')).toBe('2029-02-28')
  })
})
