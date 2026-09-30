import axios from 'axios'
import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

const KAKAO_AUTHORIZE_PATH = '/api/v1/auth/oauth/authorize/kakao'
const MEMBER_ME_PATH = '/api/v1/members/me'

export type MemberStatus = 'ONBOARDING' | 'ACTIVE'

export type CurrentMember = {
  member_id: number
  nickname: string
  email: string | null
  profile_image_url: string | null
  language_code: string
  status: MemberStatus
  unread_count: number
}

let cachedCurrentMember: CurrentMember | null = null

export function getCachedCurrentMember(): CurrentMember | null {
  return cachedCurrentMember
}

export function updateCachedCurrentMemberStatus(status: MemberStatus): void {
  if (cachedCurrentMember) cachedCurrentMember = { ...cachedCurrentMember, status }
}

export function clearCachedCurrentMember(): void {
  cachedCurrentMember = null
}

function isCurrentMember(value: unknown): value is CurrentMember {
  if (typeof value !== 'object' || value === null) return false

  const member = value as Record<string, unknown>
  return (
    typeof member.member_id === 'number' &&
    typeof member.nickname === 'string' &&
    (typeof member.email === 'string' || member.email === null) &&
    (typeof member.profile_image_url === 'string' || member.profile_image_url === null) &&
    typeof member.language_code === 'string' &&
    (member.status === 'ONBOARDING' || member.status === 'ACTIVE') &&
    typeof member.unread_count === 'number'
  )
}

export function getKakaoAuthorizeUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  return `${apiBaseUrl.replace(/\/$/, '')}${KAKAO_AUTHORIZE_PATH}`
}

export function startKakaoLogin(): void {
  window.location.assign(getKakaoAuthorizeUrl())
}

export async function getCurrentMember(): Promise<CurrentMember> {
  try {
    const response = await http.get<unknown>(MEMBER_ME_PATH)
    if (!isApiResponse(response.data) || !isCurrentMember(response.data.data)) {
      throw new Error('회원 정보 응답 계약이 올바르지 않습니다.')
    }
    cachedCurrentMember = response.data.data
    return response.data.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearCachedCurrentMember()
    }
    throw error
  }
}
