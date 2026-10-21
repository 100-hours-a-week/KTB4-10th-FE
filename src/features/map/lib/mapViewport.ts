import type { KakaoMap, KakaoMaps } from './kakaoMaps.ts'

export const MIN_KAKAO_MAP_LEVEL = 1
export const MAX_KAKAO_MAP_LEVEL = 13

export function clampKakaoMapLevel(level: number): number {
  return Math.min(MAX_KAKAO_MAP_LEVEL, Math.max(MIN_KAKAO_MAP_LEVEL, level))
}

export type Coordinate = {
  latitude: number
  longitude: number
}

export function panMapToCoordinate(
  maps: Pick<KakaoMaps, 'LatLng'>,
  map: Pick<KakaoMap, 'panTo'>,
  coordinate: Coordinate,
) {
  map.panTo(new maps.LatLng(coordinate.latitude, coordinate.longitude))
}
