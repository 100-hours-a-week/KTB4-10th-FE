import { describe, expect, it } from 'vitest'
import { getRegenerationState, regenerationUnavailableMessage } from './regeneration.ts'

describe('가이드북 재생성 상태', () => {
  it('남은 횟수와 유효시간이 있으면 재생성을 허용한다', () => {
    expect(getRegenerationState(
      { remaining_count: 3, expires_at: '2026-10-23T09:10:00Z', available: true },
      Date.parse('2026-10-23T09:09:59Z'),
    )).toEqual({ available: true, reason: null })
  })

  it('서버와 동일하게 만료 시각 경계부터 재생성을 막는다', () => {
    const state = getRegenerationState(
      { remaining_count: 2, expires_at: '2026-10-23T09:10:00Z', available: true },
      Date.parse('2026-10-23T09:10:00Z'),
    )

    expect(state).toEqual({ available: false, reason: 'expired' })
    expect(regenerationUnavailableMessage(state.reason)).toBe('가이드북 재생성 가능 시간이 지났어요.')
  })

  it('시간이 남아도 횟수를 모두 사용하면 재생성을 막는다', () => {
    const state = getRegenerationState(
      { remaining_count: 0, expires_at: '2026-10-23T09:10:00Z', available: false },
      Date.parse('2026-10-23T09:01:00Z'),
    )

    expect(state).toEqual({ available: false, reason: 'exhausted' })
  })
})
