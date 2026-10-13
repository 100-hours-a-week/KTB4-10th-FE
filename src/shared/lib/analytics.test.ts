import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from './analytics.ts'

describe('사용자 행동 분석', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.gtag
  })

  it('production에서만 GA 이벤트를 전송한다', () => {
    const gtag = vi.fn()
    window.gtag = gtag

    vi.stubEnv('PROD', false)
    trackEvent('login', { method: 'kakao' })
    expect(gtag).not.toHaveBeenCalled()

    vi.stubEnv('PROD', true)
    trackEvent('login', { method: 'kakao' })
    expect(gtag).toHaveBeenCalledWith('event', 'login', { method: 'kakao' })
  })
})
