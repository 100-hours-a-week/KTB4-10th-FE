import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestWithCsrf } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'
import { getMemberSettings, updatePushEnabled } from './memberSettings.ts'

vi.mock('../../../shared/api/http.ts', () => ({ http: { get: vi.fn() } }))
vi.mock('../../../shared/api/csrf.ts', () => ({ requestWithCsrf: vi.fn() }))

describe('회원 알림 설정 API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('현재 실시간 알림 수신 설정을 조회한다', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        message: 'member_setting_get_success',
        data: { language_code: 'ko', push_enabled: true },
      },
    })

    await expect(getMemberSettings()).resolves.toEqual({
      language_code: 'ko',
      push_enabled: true,
    })
    expect(http.get).toHaveBeenCalledWith('/api/v1/members/me/settings', {
      signal: undefined,
    })
  })

  it('알림 설정 변경 응답의 boolean 계약을 검증한다', async () => {
    vi.mocked(requestWithCsrf).mockResolvedValue({
      message: 'member_setting_update_success',
      data: { language_code: 'ko', push_enabled: false },
    })

    await expect(updatePushEnabled(false)).resolves.toEqual({
      language_code: 'ko',
      push_enabled: false,
    })
    expect(requestWithCsrf).toHaveBeenCalledWith({
      method: 'patch',
      url: '/api/v1/members/me/settings',
      data: { push_enabled: false },
    })
  })
})
