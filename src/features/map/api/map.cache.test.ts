import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('../../../shared/api/http.ts', () => ({
  http: { get: getMock },
}))

import {
  clearMapContentCache,
  getMapContents,
  mapContentCacheKey,
  type MapBounds,
} from './map.ts'

const bounds: MapBounds = {
  south: 37.35,
  west: 127.05,
  north: 37.45,
  east: 127.15,
  zoom: 16,
  limit: 200,
}

const response = {
  data: {
    message: 'map_content_success',
    data: { mode: 'CONTENT', clusters: [], items: [], has_more: false },
  },
}

describe('지도 콘텐츠 브라우저 캐시', () => {
  beforeEach(() => {
    clearMapContentCache()
    getMock.mockReset()
    getMock.mockResolvedValue(response)
  })

  it('같은 줌과 지도 영역의 응답을 재사용한다', async () => {
    await getMapContents(bounds)
    await getMapContents({ ...bounds })

    expect(getMock).toHaveBeenCalledOnce()
  })

  it('진행 중인 동일 요청을 하나로 합친다', async () => {
    await Promise.all([getMapContents(bounds), getMapContents({ ...bounds })])

    expect(getMock).toHaveBeenCalledOnce()
  })

  it('줌 레벨이 다르면 별도 요청한다', async () => {
    await getMapContents(bounds)
    await getMapContents({ ...bounds, zoom: 15 })

    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('미세한 좌표 차이는 같은 화면 영역 키로 정규화한다', () => {
    expect(mapContentCacheKey(bounds)).toBe(mapContentCacheKey({
      ...bounds,
      south: bounds.south + 0.00001,
      east: bounds.east - 0.00001,
    }))
  })

  it('캐시를 비우면 같은 영역을 다시 조회한다', async () => {
    await getMapContents(bounds)
    clearMapContentCache()
    await getMapContents(bounds)

    expect(getMock).toHaveBeenCalledTimes(2)
  })
})
