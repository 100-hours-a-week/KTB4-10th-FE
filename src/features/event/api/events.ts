import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

const NEW_EVENTS_PATH = '/api/v1/events/new'
const EVENTS_PATH = '/api/v1/contents'
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export type EventListItem = {
  content_id: string
  title: string
  category: 'EVENT'
  region: { administrative_code: string; name: string } | null
  address?: string | null
  thumbnail_url: string | null
  event_period?: { start_date: string | null; end_date: string | null } | null
}

export type EventList = {
  items: EventListItem[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

export type NewEventItem = {
  content_id: string
  title: string
  address: string | null
  thumbnail_url: string | null
  start_date: string | null
  end_date: string | null
  source_created_at: string
}

export type NewEventList = {
  date: string
  items: NewEventItem[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

export type EventDetail = {
  content_id: string
  title: string
  category: string
  region: { administrative_code: string; name: string } | null
  latitude: number | null
  longitude: number | null
  thumbnail_url: string | null
  description: string | null
  address: string | null
  phone: string | null
  homepage_url: string | null
  images: Array<{ image_id: string; image_url: string; sort_order: number }>
  event_detail: {
    start_date: string | null
    end_date: string | null
    operating_hours: string | null
    organizer: string | null
    organizer_phone: string | null
    event_place: string | null
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isNewEventItem(value: unknown): value is NewEventItem {
  return isRecord(value) &&
    typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    isNullableString(value.address) &&
    isNullableString(value.thumbnail_url) &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    typeof value.source_created_at === 'string'
}

function isNewEventList(value: unknown): value is NewEventList {
  return isRecord(value) &&
    typeof value.date === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isNewEventItem) &&
    typeof value.page === 'number' &&
    typeof value.size === 'number' &&
    typeof value.total_items === 'number' &&
    typeof value.total_pages === 'number'
}

function isEventListItem(value: unknown): value is EventListItem {
  return isRecord(value) &&
    typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    value.category === 'EVENT' &&
    isNullableString(value.thumbnail_url)
}

function isEventList(value: unknown): value is EventList {
  return isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isEventListItem) &&
    typeof value.page === 'number' &&
    typeof value.size === 'number' &&
    typeof value.total_items === 'number' &&
    typeof value.total_pages === 'number'
}

function isEventDetail(value: unknown): value is EventDetail {
  if (!isRecord(value) || !Array.isArray(value.images)) return false
  return typeof value.content_id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.category === 'string' &&
    isNullableString(value.thumbnail_url) &&
    isNullableString(value.description) &&
    isNullableString(value.address) &&
    isNullableString(value.phone) &&
    isNullableString(value.homepage_url)
}

export function seoulYesterday(now = Date.now()): string {
  return SEOUL_DATE_FORMATTER.format(new Date(now - ONE_DAY_MS))
}

export async function getNewEvents(signal?: AbortSignal): Promise<NewEventList> {
  const response = await http.get<unknown>(NEW_EVENTS_PATH, {
    params: { date: seoulYesterday(), page: 1, size: 20 },
    signal,
  })
  if (!isApiResponse(response.data) || !isNewEventList(response.data.data)) {
    throw new Error('신규 행사 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}

export async function getEvents(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<EventList> {
  const response = await http.get<unknown>(EVENTS_PATH, {
    params: { category: 'EVENT', page, size: 20, ...(query ? { q: query } : {}) },
    signal,
  })
  if (!isApiResponse(response.data) || !isEventList(response.data.data)) {
    throw new Error('행사 목록 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}

export async function getEventDetail(
  contentId: string,
  signal?: AbortSignal,
): Promise<EventDetail> {
  const response = await http.get<unknown>(
    `/api/v1/contents/${encodeURIComponent(contentId)}`,
    { signal },
  )
  if (!isApiResponse(response.data) || !isEventDetail(response.data.data)) {
    throw new Error('행사 상세 응답 계약이 올바르지 않습니다.')
  }
  return response.data.data
}
