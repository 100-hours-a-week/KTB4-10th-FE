import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '../../../shared/api/http.ts'
import {
  clearCachedCurrentMember,
  getCachedCurrentMember,
  getCurrentMember,
  type CurrentMember,
} from './auth.ts'

vi.mock('../../../shared/api/http.ts', () => ({
  http: { get: vi.fn() },
}))

const member: CurrentMember = {
  member_id: 1,
  nickname: '테스터',
  email: 'tester@example.com',
  profile_image_url: null,
  language_code: 'ko',
  status: 'ACTIVE',
  unread_count: 0,
}

describe('회원 정보 메모리 캐시', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    clearCachedCurrentMember()
  })

  it('회원 정보 조회에 성공하면 페이지 전환에서 재사용할 수 있도록 저장한다', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { message: '회원 정보 조회 성공', data: member },
    })

    await expect(getCurrentMember()).resolves.toEqual(member)
    expect(getCachedCurrentMember()).toEqual(member)
  })

  it('401 응답이면 만료된 회원 캐시를 제거한다', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({
        data: { message: '회원 정보 조회 성공', data: member },
      })
      .mockRejectedValueOnce(new AxiosError(
        '인증 실패',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        { status: 401 } as never,
      ))

    await getCurrentMember()
    await expect(getCurrentMember()).rejects.toBeInstanceOf(AxiosError)
    expect(getCachedCurrentMember()).toBeNull()
  })

  it('일시적인 통신 실패에서는 현재 화면을 유지할 수 있도록 캐시를 보존한다', async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({
        data: { message: '회원 정보 조회 성공', data: member },
      })
      .mockRejectedValueOnce(new Error('network error'))

    await getCurrentMember()
    await expect(getCurrentMember()).rejects.toThrow('network error')
    expect(getCachedCurrentMember()).toEqual(member)
  })
})
