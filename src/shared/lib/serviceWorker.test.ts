import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerServiceWorker, supportsServiceWorker } from './serviceWorker.ts'

describe('Service Worker 등록', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('보안 컨텍스트의 지원 브라우저에서 앱 전체 scope로 등록한다', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const registration = { update } as unknown as ServiceWorkerRegistration
    const register = vi.fn().mockResolvedValue(registration)
    vi.stubGlobal('navigator', { serviceWorker: { register } })

    expect(supportsServiceWorker()).toBe(true)
    await expect(registerServiceWorker()).resolves.toBe(registration)
    expect(register).toHaveBeenCalledWith('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    expect(update).toHaveBeenCalledOnce()
  })

  it('브라우저가 지원하지 않으면 기존 웹 앱을 그대로 실행한다', async () => {
    vi.stubGlobal('navigator', {})

    expect(supportsServiceWorker()).toBe(false)
    await expect(registerServiceWorker()).resolves.toBeNull()
  })

  it('등록이 실패해도 예외를 전파하지 않는다', async () => {
    const register = vi.fn().mockRejectedValue(new Error('등록 실패'))
    vi.stubGlobal('navigator', { serviceWorker: { register } })

    await expect(registerServiceWorker()).resolves.toBeNull()
  })
})
