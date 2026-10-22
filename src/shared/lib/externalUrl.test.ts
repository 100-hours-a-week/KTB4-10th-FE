import { describe, expect, it } from 'vitest'
import { extractExternalHttpUrl } from './externalUrl.ts'

describe('extractExternalHttpUrl', () => {
  it('URL만 저장된 값은 그대로 사용한다', () => {
    expect(extractExternalHttpUrl('https://www.songpa.go.kr')).toBe('https://www.songpa.go.kr')
  })

  it('설명이 섞인 값에서는 HTTP URL만 추출한다', () => {
    expect(extractExternalHttpUrl('공식 홈페이지 http://www.boardgamefestival.kr 안내'))
      .toBe('http://www.boardgamefestival.kr')
  })

  it('유효한 HTTP URL이 없으면 링크를 만들지 않는다', () => {
    expect(extractExternalHttpUrl('공식 홈페이지')).toBeNull()
    expect(extractExternalHttpUrl('javascript:alert(1)')).toBeNull()
  })
})
