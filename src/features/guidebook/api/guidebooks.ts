import { http } from '../../../shared/api/http.ts'
import { ensureCsrfToken, requestWithCsrf } from '../../../shared/api/csrf.ts'
import type { ApiResponse } from '../../../shared/api/types.ts'

export type Companion = 'ALONE' | 'FRIEND' | 'COUPLE' | 'FAMILY' | 'GROUP'
export type GenerationRequest = { province: string; city: string; start_date: string; end_date: string; companion: Companion; people_count: number }
export type GenerationProgress = { step: 'queued' | 'arranging' | 'writing' | 'rendering'; message: string }
export type GenerationEvent = { job_id: number; request_id: string; sequence: number; status: Job['status']; progress: GenerationProgress | null; guidebook_id: number | null; code: string | null }
export type Job = { job_id: number; job_type?: 'INITIAL' | 'REGENERATION'; status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED'; guidebook_id: number | null; attempt_count?: number; initial_request?: GenerationRequest | null; error?: { code: string; message: string; retryable?: boolean } | null; progress?: GenerationProgress | null; sequence?: number; request_id?: string }
export type Book = { guidebook_id: number; title: string; start_date: string; end_date: string; thumbnail_url: string | null; companion: Companion }
export type BookList = { items: Book[]; next_cursor: string | null; has_more: boolean }
export type RegenerationAvailability = { remaining_count: number; expires_at: string | null; available: boolean }
export type Detail = Omit<Book, 'companion'> & { people_count: number; regeneration?: RegenerationAvailability; itinerary: { day_number: number; itinerary_date: string; items: { item_id: number; sequence: number; scheduled_time: string | null; place_snapshot: { title?: string } | null }[] }[] }
export type Viewer = { guidebook_id: number; content_html: string; version: number; updated_at: string }
export type RegenerationJob = Job & { job_type: 'REGENERATION'; current_version: number }
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await http.get<ApiResponse<T>>(`/api/v1/${path}`, { signal, timeout: 20000 })).data.data
}
export const listBooks = (cursor?: string, signal?: AbortSignal) => get<BookList>(`guidebooks?size=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, signal)
export const getBook = (id: string, signal?: AbortSignal) => get<Detail>(`guidebooks/${id}`, signal)
export const getViewer = (id: string, signal?: AbortSignal) => get<Viewer>(`guidebooks/${id}/viewer`, signal)
export const getJob = (id: number, signal?: AbortSignal) => get<Job>(`guidebook-generations/${id}`, signal)

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
const generationStatuses = new Set<Job['status']>(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'])
const progressSteps = new Set<GenerationProgress['step']>(['queued', 'arranging', 'writing', 'rendering'])

export function getGenerationStreamUrl(id: number): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/api/v1/guidebook-generations/${id}/stream`
}

export function openGenerationStream(id: number): EventSource {
  return new EventSource(getGenerationStreamUrl(id), { withCredentials: true })
}

export function parseGenerationEvent(data: string): GenerationEvent | null {
  try {
    const value: unknown = JSON.parse(data)
    if (typeof value !== 'object' || value === null) return null
    const event = value as Record<string, unknown>
    if (!Number.isSafeInteger(event.job_id) || Number(event.job_id) < 1) return null
    if (typeof event.request_id !== 'string' || !/^\d+-\d+$/.test(event.request_id)) return null
    if (!Number.isSafeInteger(event.sequence) || Number(event.sequence) < 0) return null
    if (typeof event.status !== 'string' || !generationStatuses.has(event.status as Job['status'])) return null
    if (event.guidebook_id !== null && (!Number.isSafeInteger(event.guidebook_id) || Number(event.guidebook_id) < 1)) return null
    if (event.code !== null && typeof event.code !== 'string') return null
    if (event.progress !== null) {
      if (typeof event.progress !== 'object') return null
      const progress = event.progress as Record<string, unknown>
      if (typeof progress.step !== 'string' || !progressSteps.has(progress.step as GenerationProgress['step']) || typeof progress.message !== 'string') return null
    }
    return event as GenerationEvent
  } catch {
    return null
  }
}
export async function createBook(data: GenerationRequest, key: string) {
  return (await requestWithCsrf<Job>({ method: 'post', url: '/api/v1/guidebook-generations', data, headers: { 'Idempotency-Key': key }, timeout: 20000 })).data
}
export async function retryJob(id: number) {
  return (await requestWithCsrf<Job>({ method: 'post', url: `/api/v1/guidebook-generations/${id}/retry`, timeout: 20000 })).data
}
export async function regenerateBook(id: number, feedback: string, key: string) {
  return (await requestWithCsrf<RegenerationJob>({
    method: 'post',
    url: `/api/v1/guidebooks/${id}/regenerations`,
    data: { feedback },
    headers: { 'Idempotency-Key': key },
    timeout: 20000,
  })).data
}
export async function deleteBook(id: number) {
  await ensureCsrfToken()
  await http.delete(`/api/v1/guidebooks/${id}`)
}
