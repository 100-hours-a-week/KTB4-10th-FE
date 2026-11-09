import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadKakaoMaps, resetKakaoMapsLoaderForTest, type KakaoMaps } from './kakaoMaps.ts'

describe('loadKakaoMaps', () => {
  afterEach(() => {
    resetKakaoMapsLoaderForTest()
    vi.unstubAllEnvs()
    window.kakao = undefined
    document.querySelectorAll('script[src*="dapi.kakao.com/v2/maps/sdk.js"]')
      .forEach((script) => script.remove())
  })

  it('clusterer와 services 라이브러리를 함께 요청한다', async () => {
    vi.stubEnv('VITE_KAKAO_MAP_APP_KEY', 'test-app-key')
    window.kakao = undefined

    const loading = loadKakaoMaps()
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="dapi.kakao.com/v2/maps/sdk.js"]',
    )
    expect(script).not.toBeNull()
    expect(script?.src).toContain('libraries=clusterer,services')

    const maps = { load: (callback: () => void) => callback() } as unknown as KakaoMaps
    window.kakao = { maps }
    script?.dispatchEvent(new Event('load'))

    await expect(loading).resolves.toBe(maps)
  })
})
