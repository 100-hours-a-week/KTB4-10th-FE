import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureCsrfToken } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'
import { closeNotificationStream } from '../../notification/api/notifications.ts'
import { logout } from './settings.ts'

vi.mock('../../../shared/api/csrf.ts', () => ({
  ensureCsrfToken: vi.fn(),
  resetCsrfTokenInitialization: vi.fn(),
}))
vi.mock('../../../shared/api/http.ts', () => ({ http: { post: vi.fn() } }))
vi.mock('../../auth/api/auth.ts', () => ({ clearCachedCurrentMember: vi.fn() }))
vi.mock('../../notification/api/notifications.ts', () => ({
  closeNotificationStream: vi.fn(),
}))

describe('로그아웃과 실시간 알림 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ensureCsrfToken).mockResolvedValue({
      cookie_name: 'XSRF-TOKEN',
      header_name: 'X-XSRF-TOKEN',
    })
    vi.mocked(http.post).mockResolvedValue({ status: 204 })
  })

  it('로그아웃 성공 후 전역 EventSource를 닫는다', async () => {
    await logout()

    expect(http.post).toHaveBeenCalledWith('/api/v1/auth/logout')
    expect(closeNotificationStream).toHaveBeenCalledOnce()
  })
})
