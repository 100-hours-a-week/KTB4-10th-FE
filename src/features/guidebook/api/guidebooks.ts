import { http } from '../../../shared/api/http.ts'
import { ensureCsrfToken, requestWithCsrf } from '../../../shared/api/csrf.ts'
import type { ApiResponse } from '../../../shared/api/types.ts'

export type Companion = 'ALONE' | 'FRIEND' | 'COUPLE' | 'FAMILY' | 'GROUP'
export type GenerationRequest = { province: string; city: string; start_date: string; end_date: string; companion: Companion; people_count: number }
export type Job = { job_id: number; status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED'; guidebook_id: number | null; attempt_count?: number; error?: { code: string; message: string } | null }
export type Book = { guidebook_id: number; title: string; start_date: string; end_date: string; companion: Companion }
export type BookList = { items: Book[]; next_cursor: string | null; has_more: boolean }
export type Detail = Omit<Book, 'companion'> & { people_count: number; itinerary: { day_number: number; itinerary_date: string; items: { item_id: number; sequence: number; scheduled_time: string | null; place_snapshot: { title?: string } | null }[] }[] }
export type Viewer = { guidebook_id: number; content_html: string; version: number; updated_at: string }
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await http.get<ApiResponse<T>>(`/api/v1/${path}`, { signal, timeout: 20000 })).data.data
}
export const listBooks = (cursor?: string, signal?: AbortSignal) => get<BookList>(`guidebooks?size=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, signal)
export const getBook = (id: string, signal?: AbortSignal) => get<Detail>(`guidebooks/${id}`, signal)
export const getViewer = (id: string, signal?: AbortSignal) => get<Viewer>(`guidebooks/${id}/viewer`, signal)
export const getJob = (id: number, signal?: AbortSignal) => get<Job>(`guidebook-generations/${id}`, signal)
export async function createBook(data: GenerationRequest, key: string) {
  return (await requestWithCsrf<Job>({ method: 'post', url: '/api/v1/guidebook-generations', data, headers: { 'Idempotency-Key': key }, timeout: 20000 })).data
}
export async function retryJob(id: number) {
  return (await requestWithCsrf<Job>({ method: 'post', url: `/api/v1/guidebook-generations/${id}/retry`, timeout: 20000 })).data
}
export async function deleteBook(id: number) {
  await ensureCsrfToken()
  await http.delete(`/api/v1/guidebooks/${id}`)
}
