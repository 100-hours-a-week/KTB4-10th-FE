import axios from 'axios'
export const companions = { ALONE: ['혼자', 1, 1], FRIEND: ['친구', 2, 4], COUPLE: ['연인', 2, 2], FAMILY: ['가족', 2, 6], GROUP: ['단체', 2, 10] } as const
export function today() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map((type) => parts.find((p) => p.type === type)!.value).join('-')
}
export function dayOffset(value: string, count: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}
export function yearLimit(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate()
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}
export function message(error: unknown) {
  const code = axios.isAxiosError(error) ? error.response?.data?.error?.code : ''
  const messages: Record<string, string> = { CREDIT_INSUFFICIENT: '사용 가능한 생성권이 없어요.', GENERATION_IN_PROGRESS: '이미 생성 중인 가이드북이 있어요.', PREFERENCE_INVALID: '취향 선택을 먼저 완료해 주세요.', GUIDEBOOK_INVALID_REGION: '지역을 다시 선택해 주세요.', GUIDEBOOK_INVALID_PERIOD: '기간을 다시 확인해 주세요.', AUTH_SESSION_REQUIRED: '로그인이 필요해요.', RESOURCE_NOT_FOUND: '가이드북을 찾을 수 없어요.', RESOURCE_FORBIDDEN: '접근할 수 없어요.' }
  return messages[code] ?? '요청을 처리하지 못했어요. 다시 시도해 주세요.'
}
