import { describe, expect, it } from 'vitest'
import type { MapContentItem } from '../api/map.ts'
import { pinColor } from '../lib/mapMarkers.ts'

function item(
  contentType: MapContentItem['content_type'],
  inGuidebook = false,
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
    is_favorite: false,
    is_in_guidebook: inGuidebook,
  }
}

describe('지도 핀 색상', () => {
  it('가이드북 포함 장소를 가장 우선해 구분한다', () => {
    expect(pinColor(item('EVENT', true))).toBe('#b76e42')
  })

  it('행사와 일반 장소 색상을 구분한다', () => {
    expect(pinColor(item('EVENT'))).toBe('#5b4b8a')
    expect(pinColor(item('PLACE'))).toBe('#4a6754')
  })
})
