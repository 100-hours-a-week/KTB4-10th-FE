import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

export type PolicyType = 'terms' | 'privacy'

export type Policy = {
  policy_type: PolicyType
  title: string
  format: 'MARKDOWN'
  content: string
}

function isPolicy(value: unknown): value is Policy {
  if (typeof value !== 'object' || value === null) return false
  const policy = value as Record<string, unknown>
  return (
    (policy.policy_type === 'terms' || policy.policy_type === 'privacy') &&
    typeof policy.title === 'string' &&
    policy.format === 'MARKDOWN' &&
    typeof policy.content === 'string'
  )
}

export async function getPolicy(policyType: PolicyType): Promise<Policy> {
  const response = await http.get<unknown>(`/api/v1/policies/${policyType}`)
  if (!isApiResponse(response.data) || !isPolicy(response.data.data)) {
    throw new Error('정책 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}
