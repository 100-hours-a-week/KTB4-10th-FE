import { requestWithCsrf } from '../../../shared/api/csrf.ts'

type MemberSettings = {
  language_code: string
  push_enabled: boolean
}

export async function updatePushEnabled(pushEnabled: boolean): Promise<MemberSettings> {
  const response = await requestWithCsrf<MemberSettings>({
    method: 'patch',
    url: '/api/v1/members/me/settings',
    data: { push_enabled: pushEnabled },
  })
  return response.data
}
