import {
  loadKakaoMaps,
  type KakaoAddressSearchResult,
} from '../lib/kakaoMaps.ts'
import type { MapSearchRegion } from '../model/mapSearchRegions.ts'
import { SERVICE_REGIONS } from '../../../shared/model/serviceRegions.ts'

const REGION_SEARCH_SIZE = 30
const REGION_MAP_LEVEL = 5

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

function fullProvinceName(name: string): string {
  const normalizedName = normalized(name)
  const matched = SERVICE_REGIONS.find(({ label, fullName, aliases = [] }) => (
    [label, fullName, ...aliases].some((candidate) => normalized(candidate) === normalizedName)
  ))
  return matched?.fullName ?? name.trim()
}

function regionLabel(result: KakaoAddressSearchResult): string {
  const address = result.address
  if (!address) return result.address_name.trim().split(/\s+/).at(-1) ?? result.address_name
  if (address.region_3depth_name.trim()) return address.region_3depth_name.trim()
  if (address.region_3depth_h_name.trim()) return address.region_3depth_h_name.trim()
  if (address.region_2depth_name.trim()) {
    return address.region_2depth_name.trim().split(/\s+/).at(-1) ?? address.region_2depth_name
  }
  return address.region_1depth_name.trim() || result.address_name
}

function regionFullName(result: KakaoAddressSearchResult): string {
  const address = result.address
  if (!address) return result.address_name.trim()
  const province = fullProvinceName(address.region_1depth_name)
  const district = address.region_2depth_name.trim()
  const neighborhood = (
    address.region_3depth_name.trim() || address.region_3depth_h_name.trim()
  )
  return [province, district, neighborhood].filter(Boolean).join(' ')
}

export function normalizeKakaoRegionResults(
  results: readonly KakaoAddressSearchResult[],
): MapSearchRegion[] {
  const regions = new Map<string, MapSearchRegion>()

  for (const result of results) {
    if (result.address_type !== 'REGION') continue
    const latitude = Number(result.y)
    const longitude = Number(result.x)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue

    const fullName = regionFullName(result)
    const key = normalized(fullName)
    if (!key || regions.has(key)) continue
    const code = result.address?.b_code || result.address?.h_code ||
      `kakao:${key}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`
    regions.set(key, {
      code,
      label: regionLabel(result),
      fullName,
      latitude,
      longitude,
      level: REGION_MAP_LEVEL,
    })
  }

  return [...regions.values()]
}

export function filterKakaoRegionMatches(
  regions: readonly MapSearchRegion[],
  query: string,
): MapSearchRegion[] {
  const normalizedQuery = normalized(query)
  if (!normalizedQuery) return []
  const exactMatches = regions.filter(({ label, fullName }) => (
    normalized(label) === normalizedQuery || normalized(fullName) === normalizedQuery
  ))
  if (exactMatches.length > 0) return exactMatches

  const terms = query.trim().split(/\s+/).map(normalized).filter(Boolean)
  const partialMatches = regions.filter(({ fullName }) => {
    const normalizedFullName = normalized(fullName)
    return terms.every((term) => normalizedFullName.includes(term))
  })
  return partialMatches.length > 0 ? partialMatches : [...regions]
}

function abortError(): Error {
  const error = new Error('지역 검색 요청이 취소되었습니다.')
  error.name = 'AbortError'
  return error
}

export async function searchKakaoRegions(
  query: string,
  signal?: AbortSignal,
): Promise<MapSearchRegion[]> {
  const normalizedQuery = query.trim().slice(0, 10)
  if (!normalizedQuery) return []
  if (signal?.aborted) throw abortError()

  const maps = await loadKakaoMaps()
  const services = maps.services
  if (!services) throw new Error('카카오 지도 services 라이브러리를 사용할 수 없습니다.')
  if (signal?.aborted) throw abortError()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      action()
    }
    const onAbort = () => finish(() => reject(abortError()))
    signal?.addEventListener('abort', onAbort, { once: true })

    const geocoder = new services.Geocoder()
    geocoder.addressSearch(normalizedQuery, (results, status) => {
      if (signal?.aborted) {
        onAbort()
        return
      }
      if (status === services.Status.OK) {
        const regions = normalizeKakaoRegionResults(results)
        finish(() => resolve(filterKakaoRegionMatches(regions, normalizedQuery)))
        return
      }
      if (status === services.Status.ZERO_RESULT) {
        finish(() => resolve([]))
        return
      }
      finish(() => reject(new Error('세부 지역 검색을 불러오지 못했습니다.')))
    }, {
      page: 1,
      size: REGION_SEARCH_SIZE,
      analyze_type: services.AnalyzeType.SIMILAR,
    })
  })
}
