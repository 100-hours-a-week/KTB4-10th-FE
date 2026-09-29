import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidebookCreatePage } from './GuidebookCreatePage.tsx'
import { GuidebookListPage } from './GuidebookListPage.tsx'
import { GuidebookViewerPage } from './GuidebookViewerPage.tsx'
import { today, dayOffset } from '../model/conditions.ts'

const { createBook, listBooks, deleteBook, getViewer, track } = vi.hoisted(() => ({
  createBook: vi.fn(), listBooks: vi.fn(), deleteBook: vi.fn(), getViewer: vi.fn(), track: vi.fn(),
}))
vi.mock('../api/guidebooks.ts', () => ({ createBook, listBooks, deleteBook, getViewer }))
vi.mock('../model/generation.ts', () => ({
  isRunning: () => false,
  useGeneration: () => ({ track, job: null, error: '', dismiss: vi.fn(), refresh: vi.fn() }),
}))

describe('가이드북 화면', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('접수 응답 유실 시 같은 멱등 키와 입력으로 다시 요청한다', async () => {
    createBook.mockRejectedValueOnce(new Error('응답 유실')).mockResolvedValue({ job_id: 31, status: 'PENDING', guidebook_id: null })
    render(<MemoryRouter><Routes>
      <Route path="/" element={<GuidebookCreatePage />} />
      <Route path="/guidebooks/generating/:jobId" element={<p>생성 진행 화면</p>} />
    </Routes></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '경상북도' } })
    fireEvent.change(screen.getByLabelText('시·군·구'), { target: { value: '경주시' } })
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: today() } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: dayOffset(today(), 2) } })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    fireEvent.click(await screen.findByRole('button', { name: '같은 요청 다시 확인' }))
    expect(await screen.findByText('생성 진행 화면')).toBeInTheDocument()
    expect(createBook).toHaveBeenCalledTimes(2)
    expect(createBook.mock.calls[0]).toEqual(createBook.mock.calls[1])
    expect(track).toHaveBeenCalledWith({ job_id: 31, status: 'PENDING', guidebook_id: null })
  })

  it('혼자는 1명, 연인은 2명만 선택하며 시도 변경 시 시군구를 비운다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)
    expect(screen.getByLabelText('인원').querySelectorAll('option')).toHaveLength(1)
    expect(screen.getByLabelText('인원')).toHaveValue('1')
    fireEvent.change(screen.getByLabelText('동행'), { target: { value: 'COUPLE' } })
    expect(screen.getByLabelText('인원')).toHaveValue('2')
    expect(screen.getByLabelText('인원').querySelectorAll('option')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '경상북도' } })
    fireEvent.change(screen.getByLabelText('시·군·구'), { target: { value: '경주시' } })
    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '서울특별시' } })
    expect(screen.getByLabelText('시·군·구')).toHaveValue('')
  })

  it('필수 조건 전에는 생성 버튼을 비활성화하고 단체는 5명부터 선택한다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('동행'), { target: { value: 'GROUP' } })
    expect(screen.getByLabelText('인원')).toHaveValue('5')
    expect(screen.getByLabelText('인원').querySelectorAll('option')).toHaveLength(6)
  })

  it('목록의 커서를 사용해 더 불러오고 삭제 확인 후 서버 목록을 갱신한다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValueOnce({ items: [book], next_cursor: 'cursor/1', has_more: true })
      .mockResolvedValueOnce({ items: [{ ...book, guidebook_id: 11, title: '다음 여행' }], next_cursor: null, has_more: false })
      .mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    deleteBook.mockResolvedValue(undefined)
    render(<MemoryRouter><GuidebookListPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '더 보기' }))
    expect(await screen.findByText('다음 여행')).toBeInTheDocument()
    expect(listBooks).toHaveBeenCalledWith('cursor/1', expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('button', { name: '다음 여행 삭제' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('삭제하시겠습니까?')
    expect(deleteBook).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(deleteBook).toHaveBeenCalledWith(11))
    await waitFor(() => expect(screen.queryByText('다음 여행')).not.toBeInTheDocument())
  })

  it('뷰어는 전체 화면에서 내부 스크립트와 탭 감지를 지원한다', async () => {
    const html = '<!doctype html><html><head><style>h1{color:red}</style></head><body><h1>여행</h1><table><tr><td>일정</td></tr></table></body></html>'
    getViewer.mockResolvedValue({ guidebook_id: 10, content_html: html, version: 1, updated_at: '2026-09-29T00:00:00Z' })
    render(<MemoryRouter initialEntries={['/guidebooks/10/viewer']}><Routes><Route path="/guidebooks/:guidebookId/viewer" element={<GuidebookViewerPage />} /></Routes></MemoryRouter>)
    const viewer = await screen.findByTitle('가이드북 본문') as HTMLIFrameElement
    expect(viewer.getAttribute('srcdoc')).toContain('<body><h1>여행</h1><table><tr><td>일정</td></tr></table>')
    expect(viewer.getAttribute('srcdoc')).toContain('kgb:guidebook-interaction')
    expect(viewer).toHaveAttribute('sandbox', 'allow-scripts')
    expect(screen.queryByRole('link', { name: '가이드북 뷰어 닫기' })).not.toBeInTheDocument()
    await act(async () => { window.dispatchEvent(new MessageEvent('message', { data: 'kgb:guidebook-interaction', source: viewer.contentWindow })) })
    expect(screen.getByRole('link', { name: '가이드북 뷰어 닫기' })).toBeVisible()
  })
})
