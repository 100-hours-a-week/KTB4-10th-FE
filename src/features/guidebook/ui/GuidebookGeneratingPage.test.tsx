import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidebookGeneratingPage } from './GuidebookGeneratingPage.tsx'

const { retry, dismiss, refresh, track } = vi.hoisted(() => ({
  retry: vi.fn(),
  dismiss: vi.fn(),
  refresh: vi.fn(),
  track: vi.fn(),
}))

vi.mock('../model/generation.ts', () => ({
  isRunning: (job: { status?: string } | null) => job?.status === 'PENDING' || job?.status === 'PROCESSING',
  useGeneration: () => ({
    job: { job_id: 29, status: 'FAILED', guidebook_id: null, attempt_count: 1 },
    error: '',
    retry,
    refresh,
    busy: false,
    dismiss,
    track,
  }),
}))

describe('가이드북 생성 실패 화면', () => {
  beforeEach(() => vi.clearAllMocks())

  it('오류 안내와 남은 재생성 횟수를 표시하고 다시 시도한다', () => {
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '가이드북을 만들지 못했어요' })).toBeInTheDocument()
    expect(screen.getByText(/서버 오류가 발생했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/재생성 가능 횟수/)).toHaveTextContent('재생성 가능 횟수 2회')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
