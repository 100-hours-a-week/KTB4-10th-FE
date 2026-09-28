import { describe, expect, it } from 'vitest'
import { distanceKilometers, filterContentsWithinRadius, type MapContentItem } from './map.ts'

function item(
  contentId: string,
  latitude: number,
  longitude: number,
): MapContentItem {
  return {
    content_id: contentId,
    title: contentId,
    content_type: 'PLACE',
    address: '서울',
    latitude,
    longitude,
    thumbnail_url: null,
    event_period: null,
    is_favorite: false,
  }
}

describe('지도 콘텐츠 거리 필터', () => {
  const seoulCityHall = { latitude: 37.5665, longitude: 126.978 }

  it('두 좌표 사이의 거리를 km로 계산한다', () => {
    const distance = distanceKilometers(seoulCityHall, {
      latitude: 37.5651,
      longitude: 126.98955,
    })

    expect(distance).toBeGreaterThan(0.9)
    expect(distance).toBeLessThan(1.2)
  })

  it('현재 위치 반경 3km를 벗어난 콘텐츠를 제외한다', () => {
    const nearby = item('nearby', 37.5651, 126.98955)
    const farAway = item('far-away', 37.5444, 127.0374)

    expect(filterContentsWithinRadius([nearby, farAway], seoulCityHall, 3))
      .toEqual([nearby])
  })
})
