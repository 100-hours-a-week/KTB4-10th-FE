import { describe, expect, it, vi } from 'vitest'
import type { MapContentItem } from '../api/map.ts'
import { clusterLabel, pinColor, serverClusterStyle } from '../lib/mapMarkers.ts'
import { panMapToCoordinate } from '../lib/mapViewport.ts'

function item(
  contentType: MapContentItem['content_type'],
  inGuidebook = false,
  favorite = false,
): MapContentItem {
  return {
    content_id: 'content-1',
    title: '콘텐츠',
    content_type: contentType,
    address: '서울',
    latitude: 37.5665,
    longitude: 126.978,
    thumbnail_url: null,
    event_period: null,
    is_favorite: favorite,
    is_in_guidebook: inGuidebook,
  }
}

describe('지도 핀 색상', () => {
  it('가이드북 포함 장소를 가장 우선해 구분한다', () => {
    expect(pinColor(item('EVENT', true, true))).toBe('#f5c542')
  })

  it('즐겨찾기를 행사와 일반 장소보다 우선해 구분한다', () => {
    expect(pinColor(item('EVENT', false, true))).toBe('#e85d75')
    expect(pinColor(item('PLACE', false, true))).toBe('#e85d75')
  })

  it('행사와 일반 장소 색상을 구분한다', () => {
    expect(pinColor(item('EVENT'))).toBe('#5b4b8a')
    expect(pinColor(item('PLACE'))).toBe('#4a6754')
  })
})

describe('지도 클러스터 표기', () => {
  it('두 자리 수와 세 자리 수를 각각 축약한다', () => {
    expect(clusterLabel(9)).toBe('9')
    expect(clusterLabel(10)).toBe('9+')
    expect(clusterLabel(99)).toBe('9+')
    expect(clusterLabel(100)).toBe('99+')
  })

  it('광역 줌일수록 클러스터를 작고 투명하게 표시한다', () => {
    expect(serverClusterStyle(13, 200)).toEqual({
      size: 28,
      fontSize: 11,
      fillOpacity: 0.7,
    })
    expect(serverClusterStyle(10, 200)).toEqual({
      size: 32,
      fontSize: 13,
      fillOpacity: 0.8,
    })
    expect(serverClusterStyle(8, 200)).toEqual({
      size: 38,
      fontSize: 13,
      fillOpacity: 0.9,
    })
  })

  it('콘텐츠가 적은 클러스터는 지역 줌에서도 더 작게 표시한다', () => {
    expect(serverClusterStyle(8, 4).size).toBe(24)
    expect(serverClusterStyle(8, 40).size).toBe(30)
  })
})

describe('지도 중심 이동', () => {
  it('현재 줌 레벨을 변경하지 않고 지정 좌표로 이동한다', () => {
    const position = { latitude: 37.3952969470752, longitude: 127.110449292622 }
    const latLng = { position }
    const maps = { LatLng: vi.fn(function LatLng() { return latLng }) }
    const map = { panTo: vi.fn(), setLevel: vi.fn() }

    panMapToCoordinate(maps as never, map, position)

    expect(maps.LatLng).toHaveBeenCalledWith(position.latitude, position.longitude)
    expect(map.panTo).toHaveBeenCalledWith(latLng)
    expect(map.setLevel).not.toHaveBeenCalled()
  })
})
