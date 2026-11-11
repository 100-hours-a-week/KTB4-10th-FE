import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
    generation.job.error = { code: 'generation_timeout', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', retryable: true }
  })

  it.each(['PENDING', 'PROCESSING'] as const)('%s 상태에 단계 진행바를 표시한다', (status) => {
    generation.job = { job_id: 29, status, guidebook_id: null, attempt_count: 0 }
    const { container } = render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '가이드북을 만들고 있어요' })).toBeInTheDocument()
    expect(screen.getByText(/완성되면 알림으로 알려드릴게요/)).toBeInTheDocument()
    expect(screen.getByText('다른 화면을 이용해도 생성은 계속돼요.')).toBeInTheDocument()
    const progress = screen.getByRole('progressbar', { name: '가이드북 생성 단계' })
    expect(progress).toHaveAttribute('aria-valuemax', '5')
    if (status === 'PENDING') expect(progress).toHaveAttribute('aria-valuenow', '1')
    else expect(progress).not.toHaveAttribute('aria-valuenow')
    const animation = container.querySelector('.book-generation-animation')
    expect(animation).toBeInTheDocument()
    expect(animation).toHaveAttribute('src', '/assets/guidebook/kgb-loader.svg')
    expect(animation).toHaveAttribute('alt', '')
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
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
  })

  it('SSE로 받은 checking 단계 문구를 표시한다', () => {
    generation.job = {
      job_id: 29,
      status: 'PROCESSING',
      guidebook_id: null,
      attempt_count: 0,
      progress: { step: 'checking', message: '여행 조건을 확인하고 있어요.' },
    }
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByText('여행 조건을 확인하고 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  })

  it('오류 안내와 남은 재시도 횟수를 표시하고 다시 시도한다', () => {
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '가이드북을 만들지 못했어요' })).toBeInTheDocument()
    expect(screen.getByRole('alert', { name: '실패 사유' }))
      .toHaveTextContent('서버 오류가 발생했습니다.')
    expect(screen.getByText(/다시 시도 가능 횟수/)).toHaveTextContent('다시 시도 가능 횟수 2회')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '가이드북 목록' }))
      .toHaveClass('secondary-button')

    expect(screen.getByRole('button', { name: '다시 시도' })).toHaveClass('book-retry-button')
    expect(screen.getByRole('button', { name: '다시 시도' }).closest('section'))
      .toHaveClass('book-generation--failed')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('재생성은 생략하는 장소 확인을 제외한 단계로 표시한다', () => {
    generation.job = { job_id: 29, job_type: 'REGENERATION', status: 'PROCESSING',
      guidebook_id: 124, progress: { step: 'writing', message: '수정한 내용을 작성하고 있어요.' } }
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    expect(screen.queryByText('장소 확인')).not.toBeInTheDocument()
  })

  it('새 시도로 돌아가면 이전 작성 단계 대신 접수 대기를 표시한다', () => {
    generation.job = { job_id: 29, status: 'PROCESSING', guidebook_id: null,
      progress: { step: 'rendering', message: '최종 정리 중이에요.' } }
    const content = <MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>
    const view = render(content)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    generation.job = { job_id: 29, status: 'PENDING', guidebook_id: null, attempt_count: 1 }
    view.rerender(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
    </Routes></MemoryRouter>)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })

  it('피드백 거절이면 재시도 대신 피드백 수정 화면으로 보낸다', () => {
    generation.job = {
      job_id: 29,
      job_type: 'REGENERATION',
      submitted_feedback: '둘째 날 여유롭게',
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

    expect(screen.getByRole('alert', { name: '실패 사유' }))
      .toHaveTextContent('수정 요청을 적용할 수 없습니다.')
    expect(screen.getByRole('complementary', { name: '수정 안내' }))
      .toHaveTextContent('피드백 내용에 문제가 있어요.')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '피드백 수정하기' })).toHaveAttribute(
      'href',
      '/guidebooks/124/regenerate',
    )
    expect(screen.getByRole('link', { name: '피드백 수정하기' }))
      .toHaveClass('secondary-button')
    expect(screen.getByRole('button', { name: '가이드북으로' }))
      .toHaveClass('secondary-button')
  })

  it('최초 생성 실패는 수정하기 하나로 기존 입력 전체를 복원한다', () => {
    const initial = { province: '서울특별시', city: '중구', start_date: '2026-11-21',
      end_date: '2026-11-22', companion: 'COUPLE' as const, people_count: 2, user_request: '첫날 오후 시작' }
    generation.job = { job_id: 29, job_type: 'INITIAL', status: 'FAILED', guidebook_id: null,
      initial_request: initial, error: { code: 'feedback_not_applicable', message: '해당 요청을 반영할 수 없어요.', retryable: false } }
    function Destination() {
      return <pre data-testid="draft">{JSON.stringify(useLocation().state)}</pre>
    }
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
      <Route path="/guidebooks/new" element={<Destination />} />
    </Routes></MemoryRouter>)
    expect(screen.getByText(/피드백 내용에 문제가 있어요/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '조건 수정하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '피드백 수정하기' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '수정하기' }))
    const state = JSON.parse(screen.getByTestId('draft').textContent!)
    expect(state.guidebookDraft).toEqual(initial)
    expect(state.editFeedback).toBe(true)
  })

  it('재생성의 입력 거절도 조건 수정과 피드백 복원을 제공한다', () => {
    generation.job = { job_id: 29, job_type: 'REGENERATION', status: 'FAILED', guidebook_id: 124,
      submitted_feedback: '둘째 날 여유롭게',
      initial_request: { province: '서울특별시', city: '중구', start_date: '2026-11-21',
        end_date: '2026-11-22', companion: 'COUPLE', people_count: 2, user_request: '첫날 오후 시작' },
      error: { code: 'invalid_request', message: '생성 입력을 확인해 주세요.', retryable: false } }
    function Destination() {
      return <pre data-testid="draft">{JSON.stringify(useLocation().state)}</pre>
    }
    render(<MemoryRouter initialEntries={['/guidebooks/generating/29']}><Routes>
      <Route path="/guidebooks/generating/:jobId" element={<GuidebookGeneratingPage />} />
      <Route path="/guidebooks/:guidebookId/regenerate" element={<Destination />} />
    </Routes></MemoryRouter>)
    expect(screen.getByRole('link', { name: '조건 수정하기' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '조건 수정 안내' }))
      .toHaveTextContent('조건 수정은 새 가이드북 생성이에요.')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '피드백 수정하기' }))
    expect(JSON.parse(screen.getByTestId('draft').textContent!).feedbackDraft)
      .toEqual({ guidebookId: 124, feedback: '둘째 날 여유롭게' })
  })
})
