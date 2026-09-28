export type KakaoLatLng = {
  getLat: () => number
  getLng: () => number
}

export type KakaoBounds = {
  getSouthWest: () => KakaoLatLng
  getNorthEast: () => KakaoLatLng
}

export type KakaoMap = {
  getBounds: () => KakaoBounds
  getCenter: () => KakaoLatLng
  getLevel: () => number
  panTo: (position: KakaoLatLng) => void
  setLevel: (level: number, options?: { anchor?: KakaoLatLng }) => void
}

export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void
}

export type KakaoMaps = {
  load: (callback: () => void) => void
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap
  Marker: new (options: { map?: KakaoMap; position: KakaoLatLng; title?: string }) => KakaoMarker
  event: {
    addListener: (target: object, eventName: string, handler: () => void) => void
    removeListener: (target: object, eventName: string, handler: () => void) => void
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

let sdkLoading: Promise<KakaoMaps> | null = null

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao?.maps.load(() => resolve(window.kakao!.maps)))
  }
  if (sdkLoading) return sdkLoading

  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY?.trim()
  if (!appKey) return Promise.reject(new Error('카카오 지도 JavaScript 키가 설정되지 않았습니다.'))

  const loading = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`
    script.async = true
    script.addEventListener('load', () => {
      if (!window.kakao?.maps) {
        reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'))
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps))
    })
    script.addEventListener('error', () => reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.')))
    document.head.append(script)
  }).catch((error: unknown) => {
    sdkLoading = null
    throw error
  })
  sdkLoading = loading

  return loading
}

export function resetKakaoMapsLoaderForTest(): void {
  sdkLoading = null
}
