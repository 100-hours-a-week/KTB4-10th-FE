export type EventRegionOption = {
  code: string
  label: string
}

export const EVENT_REGION_OPTIONS: readonly EventRegionOption[] = [
  { code: '11', label: '서울' },
  { code: '12', label: '전남광주' },
  { code: '26', label: '부산' },
  { code: '27', label: '대구' },
  { code: '28', label: '인천' },
  { code: '30', label: '대전' },
  { code: '31', label: '울산' },
  { code: '36110', label: '세종' },
  { code: '41', label: '경기' },
  { code: '43', label: '충북' },
  { code: '44', label: '충남' },
  { code: '47', label: '경북' },
  { code: '48', label: '경남' },
  { code: '50', label: '제주' },
  { code: '51', label: '강원' },
  { code: '52', label: '전북' },
]

export const EVENT_MONTH_OPTIONS = Array.from(
  { length: 12 },
  (_, index) => String(index + 1).padStart(2, '0'),
)

const REGION_CODES = new Set(EVENT_REGION_OPTIONS.map(({ code }) => code))
const SEOUL_YEAR_FORMATTER = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
})

export type EventFilters = {
  query: string
  regionCode: string
  month: string
  page: number
}

export function seoulCurrentYear(now = Date.now()): string {
  return SEOUL_YEAR_FORMATTER.format(new Date(now))
}

export function readEventFilters(
  searchParams: URLSearchParams,
  now = Date.now(),
): EventFilters {
  const queryValues = searchParams.getAll('q')
  const regionValues = searchParams.getAll('region_code')
  const monthValues = searchParams.getAll('month')
  const pageValues = searchParams.getAll('page')
  const query = queryValues.length === 1 ? queryValues[0].trim().slice(0, 10) : ''
  const regionCode = regionValues.length === 1 && REGION_CODES.has(regionValues[0])
    ? regionValues[0]
    : ''
  const expectedMonth = new RegExp(`^${seoulCurrentYear(now)}-(0[1-9]|1[0-2])$`)
  const month = monthValues.length === 1 && expectedMonth.test(monthValues[0])
    ? monthValues[0]
    : ''
  const rawPage = pageValues.length === 1 ? pageValues[0] : ''
  const page = /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1

  return {
    query,
    regionCode,
    month,
    page: Number.isSafeInteger(page) ? page : 1,
  }
}

export function eventFiltersToSearchParams(filters: EventFilters): URLSearchParams {
  const searchParams = new URLSearchParams()
  if (filters.query) searchParams.set('q', filters.query)
  if (filters.regionCode) searchParams.set('region_code', filters.regionCode)
  if (filters.month) searchParams.set('month', filters.month)
  if (filters.page > 1) searchParams.set('page', String(filters.page))
  return searchParams
}

export function isCanonicalEventSearch(
  source: URLSearchParams,
  canonical: URLSearchParams,
): boolean {
  return source.toString() === canonical.toString()
}
