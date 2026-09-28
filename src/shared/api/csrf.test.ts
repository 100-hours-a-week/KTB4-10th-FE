import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureCsrfToken,
  requestWithCsrf,
  resetCsrfTokenInitialization,
} from './csrf.ts'
import { http } from './http.ts'

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
}

const csrfResponse = axiosResponse({
  message: 'csrf_token_issued',
  data: {
    cookie_name: 'XSRF-TOKEN',
    header_name: 'X-XSRF-TOKEN',
  },
})

describe('CSRF 클라이언트', () => {
  beforeEach(() => {
    resetCsrfTokenInitialization()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('세션 쿠키와 XSRF 쿠키·헤더 계약을 Axios 기본값으로 사용한다', () => {
    expect(http.defaults.withCredentials).toBe(true)
    expect(http.defaults.withXSRFToken).toBe(true)
    expect(http.defaults.xsrfCookieName).toBe('XSRF-TOKEN')
    expect(http.defaults.xsrfHeaderName).toBe('X-XSRF-TOKEN')
  })

  it('동시에 초기화해도 CSRF 조회를 한 번만 요청한다', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue(csrfResponse)

    const [first, second] = await Promise.all([
      ensureCsrfToken(),
      ensureCsrfToken(),
    ])

    expect(get).toHaveBeenCalledOnce()
    expect(get).toHaveBeenCalledWith('/api/v1/auth/csrf')
    expect(first).toEqual(csrfResponse.data.data)
    expect(second).toBe(first)
  })

  it('CSRF 초기화 실패를 캐시하지 않고 다음 호출에서 재시도한다', async () => {
    const get = vi
      .spyOn(http, 'get')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(csrfResponse)

    await expect(ensureCsrfToken()).rejects.toThrow('network error')
    await expect(ensureCsrfToken()).resolves.toEqual(csrfResponse.data.data)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('CSRF 초기화 후 상태 변경 요청을 전송한다', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue(csrfResponse)
    const request = vi.spyOn(http, 'request').mockResolvedValue(
      axiosResponse({
        message: 'preference_update_success',
        data: { status: 'ACTIVE' },
      }),
    )

    const result = await requestWithCsrf<{ status: string }>({
      method: 'put',
      url: '/api/v1/members/me/preferences',
      data: { preference_codes: ['NATURE'] },
    })

    expect(get).toHaveBeenCalledBefore(request)
    expect(request).toHaveBeenCalledWith({
      method: 'put',
      url: '/api/v1/members/me/preferences',
      data: { preference_codes: ['NATURE'] },
    })
    expect(result.data.status).toBe('ACTIVE')
  })

  it('잘못된 CSRF 응답 계약을 거부한다', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(
      axiosResponse({
        message: 'csrf_token_issued',
        data: {
          cookie_name: 'WRONG-TOKEN',
          header_name: 'X-XSRF-TOKEN',
        },
      }),
    )

    await expect(ensureCsrfToken()).rejects.toThrow(
      'CSRF 응답 계약이 올바르지 않습니다.',
    )
  })
})
