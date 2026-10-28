import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '../api/guidebooks.ts'
import { GuidebookGeneratingPage } from './GuidebookGeneratingPage.tsx'

const { retry, dismiss, refresh, track, generation } = vi.hoisted(() => ({
  retry: vi.fn(),
  dismiss: vi.fn(),
  refresh: vi.fn(),
  track: vi.fn(),
  generation: { job: { job_id: 29, status: 'FAILED', guidebook_id: null, attempt_count: 1 } as Job },
}))

vi.mock('../model/generation.ts', () => ({
  isRunning: (job: { status?: string } | null) => job?.status === 'PENDING' || job?.status === 'PROCESSING',
  useGeneration: () => ({
    job: generation.job,
    error: '',
    retry,
    refresh,
    busy: false,
    dismiss,
    track,
  }),
}))

describe('가이드북 생성 상태 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generation.job = { job_id: 29, status: 'FAILED', guidebook_id: null, attempt_count: 1 }
  })

  it.each(['PENDING', 'PROCESSING'] as const)('%s 상태를 실제 진행률 없는 단순 대기 화면으로 표시한다', (status) => {
    generation.job = { job_id: 29, status, guidebook_id: null, attempt_count: 0 }
    const { container } = render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '가이드북을 만들고 있어요' })).toBeInTheDocument()
    expect(screen.getByText(/완성되면 알림으로 알려드릴게요/)).toBeInTheDocument()
    expect(screen.getByText('다른 화면을 이용해도 생성은 계속돼요.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    const animation = container.querySelector('.book-travel-animation')
    expect(animation).toBeInTheDocument()
    expect(animation?.querySelector('svg')).toBeInTheDocument()
    expect(animation).toHaveTextContent('여행 준비 중')
  })

  it('SSE로 받은 현재 진행 단계 문구를 표시한다', () => {
    generation.job = {
      job_id: 29,
      status: 'PROCESSING',
      guidebook_id: null,
      attempt_count: 0,
      progress: { step: 'writing', message: '가이드북 문구를 작성하고 있어요.' },
    }
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByText('가이드북 문구를 작성하고 있어요.')).toBeInTheDocument()
  })

  it('오류 안내와 남은 재시도 횟수를 표시하고 다시 시도한다', () => {
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '가이드북을 만들지 못했어요' })).toBeInTheDocument()
    expect(screen.getByText(/서버 오류가 발생했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/다시 시도 가능 횟수/)).toHaveTextContent('다시 시도 가능 횟수 2회')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('피드백 거절이면 재시도 대신 피드백 수정 화면으로 보낸다', () => {
    generation.job = {
      job_id: 29,
      status: 'FAILED',
      guidebook_id: 124,
      attempt_count: 0,
      error: {
        code: 'feedback_not_applicable',
        message: '수정 요청을 적용할 수 없습니다.',
        retryable: false,
      },
    }
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByText('수정 요청을 적용할 수 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '피드백 수정하기' })).toHaveAttribute(
      'href',
      '/guidebooks/124/regenerate',
    )
  })
})
