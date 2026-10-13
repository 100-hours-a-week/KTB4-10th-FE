import { afterEach, describe, expect, it, vi } from 'vitest'

const { init } = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('@sentry/react', () => ({ init }))

import { initializeSentry } from './sentry.ts'

describe('Sentry 초기화', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('운영 DSN이 있을 때 활성화하고 식별정보와 URL query를 제거한다', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1')

    initializeSentry()

    expect(init).toHaveBeenCalledOnce()
    const options = init.mock.calls[0][0]
    expect(options).toMatchObject({
      enabled: true,
      environment: 'production',
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    })

    const event = options.beforeSend({
      user: { id: '1', email: 'member@example.com' },
      request: {
        url: 'https://kguidebook.site/auth/complete?code=secret',
        query_string: 'code=secret',
      },
    })
    expect(event.user).toBeUndefined()
    expect(event.request.url).toBe('https://kguidebook.site/auth/complete')
    expect(event.request.query_string).toBeUndefined()
  })
})
