import { describe, expect, it } from 'vitest'
import { mergeMapRegions, searchMapRegions } from './mapSearchRegions.ts'

describe('searchMapRegions', () => {
  it('축약명과 전체 지역명을 모두 검색한다', () => {
    expect(searchMapRegions('서울').map(({ code }) => code)).toEqual(['11'])
    expect(searchMapRegions('강원특별').map(({ code }) => code)).toEqual(['51'])
    expect(searchMapRegions('강원도').map(({ code }) => code)).toEqual(['51'])
    expect(searchMapRegions('전라남도').map(({ code }) => code)).toEqual(['12'])
  })

  it('공백 검색은 결과가 없다', () => {
    expect(searchMapRegions('   ')).toEqual([])
  })

  it('같은 전체 경로만 제거하고 동명 행정구역은 모두 유지한다', () => {
    const regions = mergeMapRegions([
      {
        code: '11', label: '서울', fullName: '서울특별시',
        latitude: 37.5665, longitude: 126.978, level: 5,
      },
    ], [
      {
        code: 'duplicate', label: '서울', fullName: '서울특별시',
        latitude: 37.5665, longitude: 126.978, level: 5,
      },
      {
        code: 'seoul-jung', label: '중구', fullName: '서울특별시 중구',
        latitude: 37.5636, longitude: 126.9976, level: 5,
      },
      {
        code: 'busan-jung', label: '중구', fullName: '부산광역시 중구',
        latitude: 35.1063, longitude: 129.0324, level: 5,
      },
    ])

    expect(regions.map(({ fullName }) => fullName)).toEqual([
      '서울특별시',
      '서울특별시 중구',
      '부산광역시 중구',
    ])
  })
})
