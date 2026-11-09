import { describe, expect, it } from 'vitest'
import type { KakaoAddressSearchResult } from '../lib/kakaoMaps.ts'
import { filterKakaoRegionMatches, normalizeKakaoRegionResults } from './regionSearch.ts'

function regionResult({
  addressName,
  province,
  district,
  neighborhood = '',
  latitude,
  longitude,
  code,
}: {
  addressName: string
  province: string
  district: string
  neighborhood?: string
  latitude: number
  longitude: number
  code: string
}): KakaoAddressSearchResult {
  return {
    address_name: addressName,
    address_type: 'REGION',
    x: String(longitude),
    y: String(latitude),
    address: {
      address_name: addressName,
      region_1depth_name: province,
      region_2depth_name: district,
      region_3depth_name: neighborhood,
      region_3depth_h_name: neighborhood,
      h_code: code,
      b_code: code,
      x: String(longitude),
      y: String(latitude),
    },
  }
}

describe('normalizeKakaoRegionResults', () => {
  it('동명 행정구역을 전체 경로가 다른 별도 결과로 보존한다', () => {
    const regions = normalizeKakaoRegionResults([
      regionResult({
        addressName: '서울 중구', province: '서울', district: '중구',
        latitude: 37.5636, longitude: 126.9976, code: '1114000000',
      }),
      regionResult({
        addressName: '부산 중구', province: '부산', district: '중구',
        latitude: 35.1063, longitude: 129.0324, code: '2611000000',
      }),
    ])

    expect(regions).toMatchObject([
      { label: '중구', fullName: '서울특별시 중구', code: '1114000000' },
      { label: '중구', fullName: '부산광역시 중구', code: '2611000000' },
    ])
  })

  it('읍면동 결과를 전체 행정구역 경로와 좌표로 변환한다', () => {
    const [region] = normalizeKakaoRegionResults([
      regionResult({
        addressName: '전남 해남군 송지면', province: '전남', district: '해남군',
        neighborhood: '송지면', latitude: 34.3682, longitude: 126.5185,
        code: '4682034000',
      }),
    ])

    expect(region).toMatchObject({
      label: '송지면',
      fullName: '전남광주통합특별시 해남군 송지면',
      latitude: 34.3682,
      longitude: 126.5185,
    })
  })

  it('법정동과 행정동 이름이 다르면 검색된 법정동 경로를 표시한다', () => {
    const result = regionResult({
      addressName: '전남광주통합특별시 익산시 부송동',
      province: '전남',
      district: '익산시',
      neighborhood: '부송동',
      latitude: 35.9766,
      longitude: 126.996,
      code: '4514013400',
    })
    if (result.address) result.address.region_3depth_h_name = '삼성동'

    expect(normalizeKakaoRegionResults([result])[0]).toMatchObject({
      label: '부송동',
      fullName: '전남광주통합특별시 익산시 부송동',
    })
  })

  it('도로명·상세 주소 결과와 잘못된 좌표는 지역 후보에서 제외한다', () => {
    const road = regionResult({
      addressName: '서울 중구 세종대로 110', province: '서울', district: '중구',
      latitude: 37.5663, longitude: 126.9779, code: 'road',
    })
    road.address_type = 'ROAD_ADDR'
    const invalid = regionResult({
      addressName: '서울 중구', province: '서울', district: '중구',
      latitude: 37.5636, longitude: 126.9976, code: 'invalid',
    })
    invalid.y = 'not-a-number'

    expect(normalizeKakaoRegionResults([road, invalid])).toEqual([])
  })

  it('동명 정확 일치 결과를 모두 유지하고 유사한 다른 지역명은 제외한다', () => {
    const regions = normalizeKakaoRegionResults([
      regionResult({
        addressName: '서울 중구', province: '서울', district: '중구',
        latitude: 37.5636, longitude: 126.9976, code: '1114000000',
      }),
      regionResult({
        addressName: '부산 중구', province: '부산', district: '중구',
        latitude: 35.1063, longitude: 129.0324, code: '2611000000',
      }),
      regionResult({
        addressName: '인천 영종구', province: '인천', district: '영종구',
        latitude: 37.4897, longitude: 126.5599, code: '2815500000',
      }),
    ])

    expect(filterKakaoRegionMatches(regions, '중구').map(({ fullName }) => fullName))
      .toEqual(['서울특별시 중구', '부산광역시 중구'])
    expect(filterKakaoRegionMatches(regions, '서울 중구').map(({ fullName }) => fullName))
      .toEqual(['서울특별시 중구'])
  })
})
