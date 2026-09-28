import { requestWithCsrf } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

const PREFERENCE_OPTIONS_PATH = '/api/v1/preference-options'
const MEMBER_PREFERENCES_PATH = '/api/v1/members/me/preferences'

export type PreferenceType = 'THEME' | 'DETAIL' | 'TRAVEL_STYLE'

export type PreferenceOption = {
  preference_type: PreferenceType
  code: string
  label: string
  parent_code: string | null
  sort_order: number
}

export type PreferenceSelection = {
  preference_type: PreferenceType
  preference_code: string
}

export type PreferenceUpdateResult = {
  selections: PreferenceSelection[]
  status: 'ONBOARDING' | 'ACTIVE'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPreferenceType(value: unknown): value is PreferenceType {
  return value === 'THEME' || value === 'DETAIL' || value === 'TRAVEL_STYLE'
}

function isPreferenceOption(value: unknown): value is PreferenceOption {
  if (!isRecord(value)) return false

  return (
    isPreferenceType(value.preference_type) &&
    typeof value.code === 'string' &&
    typeof value.label === 'string' &&
    (typeof value.parent_code === 'string' || value.parent_code === null) &&
    typeof value.sort_order === 'number'
  )
}

function isPreferenceSelection(value: unknown): value is PreferenceSelection {
  if (!isRecord(value)) return false

  return (
    isPreferenceType(value.preference_type) &&
    typeof value.preference_code === 'string'
  )
}

export async function getPreferenceOptions(): Promise<PreferenceOption[]> {
  const response = await http.get<unknown>(PREFERENCE_OPTIONS_PATH)
  if (!isApiResponse(response.data) || !isRecord(response.data.data)) {
    throw new Error('취향 옵션 응답 계약이 올바르지 않습니다.')
  }

  const { items } = response.data.data
  if (!Array.isArray(items) || !items.every(isPreferenceOption)) {
    throw new Error('취향 옵션 응답 계약이 올바르지 않습니다.')
  }

  return items
}

export async function getMemberPreferences(): Promise<PreferenceSelection[]> {
  const response = await http.get<unknown>(MEMBER_PREFERENCES_PATH)
  if (!isApiResponse(response.data) || !isRecord(response.data.data)) {
    throw new Error('회원 취향 응답 계약이 올바르지 않습니다.')
  }

  const { selections } = response.data.data
  if (!Array.isArray(selections) || !selections.every(isPreferenceSelection)) {
    throw new Error('회원 취향 응답 계약이 올바르지 않습니다.')
  }

  return selections
}

export async function replaceMemberPreferences(
  selections: PreferenceSelection[],
): Promise<PreferenceUpdateResult> {
  const response = await requestWithCsrf<PreferenceUpdateResult>({
    method: 'put',
    url: MEMBER_PREFERENCES_PATH,
    data: { selections },
  })

  return response.data
}
