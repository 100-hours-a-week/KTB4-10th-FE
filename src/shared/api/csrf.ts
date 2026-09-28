import type { AxiosRequestConfig } from 'axios'
import { http } from './http.ts'
import { isApiResponse, type ApiResponse } from './types.ts'

const CSRF_ENDPOINT = '/api/v1/auth/csrf'

export type CsrfContract = {
  cookie_name: 'XSRF-TOKEN'
  header_name: 'X-XSRF-TOKEN'
}

export type StateChangingMethod = 'post' | 'put' | 'patch' | 'delete'

export type StateChangingRequestConfig<D = unknown> = Omit<
  AxiosRequestConfig<D>,
  'method'
> & {
  method: StateChangingMethod
}

let csrfInitialization: Promise<CsrfContract> | null = null

function isCsrfContract(value: unknown): value is CsrfContract {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const contract = value as Record<string, unknown>

  return (
    contract.cookie_name === 'XSRF-TOKEN' &&
    contract.header_name === 'X-XSRF-TOKEN'
  )
}

async function fetchCsrfContract(): Promise<CsrfContract> {
  const response = await http.get<unknown>(CSRF_ENDPOINT)

  if (!isApiResponse(response.data) || !isCsrfContract(response.data.data)) {
    throw new Error('CSRF 응답 계약이 올바르지 않습니다.')
  }

  return response.data.data
}

export function ensureCsrfToken(): Promise<CsrfContract> {
  if (csrfInitialization === null) {
    csrfInitialization = fetchCsrfContract().catch((error: unknown) => {
      csrfInitialization = null
      throw error
    })
  }

  return csrfInitialization
}

export function resetCsrfTokenInitialization(): void {
  csrfInitialization = null
}

export async function requestWithCsrf<T, D = unknown>(
  config: StateChangingRequestConfig<D>,
): Promise<ApiResponse<T>> {
  await ensureCsrfToken()

  const response = await http.request<ApiResponse<T>>({
    ...config,
    method: config.method,
  })

  if (!isApiResponse<T>(response.data)) {
    throw new Error('API 성공 응답 계약이 올바르지 않습니다.')
  }

  return response.data
}
