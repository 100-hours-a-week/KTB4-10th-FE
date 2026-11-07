import { describe, expect, it } from 'vitest'
import { searchMapRegions } from './mapSearchRegions.ts'

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
})
