import { describe, expect, it } from 'vitest'
import { parseRetryAfterSeconds } from './coupons.ts'

describe('쿠폰 등록 제한 응답', () => {
  it('유효한 Retry-After 초를 올림해 보존한다', () => {
    expect(parseRetryAfterSeconds('95')).toBe(95)
    expect(parseRetryAfterSeconds(1.2)).toBe(2)
  })

  it('누락되거나 유효하지 않은 Retry-After는 사용하지 않는다', () => {
    expect(parseRetryAfterSeconds(undefined)).toBeNull()
    expect(parseRetryAfterSeconds('invalid')).toBeNull()
    expect(parseRetryAfterSeconds(0)).toBeNull()
  })
})
