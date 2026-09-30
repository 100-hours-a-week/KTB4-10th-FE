import type { KakaoMap, KakaoMaps } from './kakaoMaps.ts'

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
