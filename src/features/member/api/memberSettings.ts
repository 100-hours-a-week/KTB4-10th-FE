import { http } from '../../../shared/api/http.ts'
import { requestWithCsrf } from '../../../shared/api/csrf.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

export type MemberSettings = {
  language_code: string
  push_enabled: boolean
}

function isMemberSettings(value: unknown): value is MemberSettings {
  if (typeof value !== 'object' || value === null) return false
  const settings = value as Record<string, unknown>
  return (
    typeof settings.language_code === 'string' &&
    typeof settings.push_enabled === 'boolean'
  )
}

export async function getMemberSettings(signal?: AbortSignal): Promise<MemberSettings> {
  const response = await http.get<unknown>('/api/v1/members/me/settings', { signal })
  if (!isApiResponse(response.data) || !isMemberSettings(response.data.data)) {
    throw new Error('회원 설정 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}

export async function updatePushEnabled(pushEnabled: boolean): Promise<MemberSettings> {
  const response = await requestWithCsrf<MemberSettings>({
    method: 'patch',
    url: '/api/v1/members/me/settings',
    data: { push_enabled: pushEnabled },
  })
  if (!isMemberSettings(response.data)) {
    throw new Error('회원 설정 응답 계약이 올바르지 않습니다.')
  }
  return response.data
}
