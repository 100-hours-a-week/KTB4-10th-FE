import { AxiosError } from 'axios'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerationProvider } from './GenerationProvider.tsx'
import { jobStorageKey, useGeneration } from './generation.ts'

const {
  getCurrentMember,
  getJob,
  openGenerationStream,
  parseGenerationEvent,
  retryJob,
  stream,
  trackEvent,
} = vi.hoisted(() => {
  const eventTarget = new EventTarget() as EventSource
  Object.assign(eventTarget, { close: vi.fn() })
  return {
    getCurrentMember: vi.fn(),
    getJob: vi.fn(),
    openGenerationStream: vi.fn(() => eventTarget),
    parseGenerationEvent: vi.fn((data: string) => JSON.parse(data)),
    retryJob: vi.fn(),
    stream: eventTarget,
    trackEvent: vi.fn(),
  }
})

vi.mock('../../auth/api/auth.ts', () => ({ getCurrentMember }))
vi.mock('../api/guidebooks.ts', () => ({
  openGenerationStream,
  parseGenerationEvent,
  retryJob,
  getJob,
}))
vi.mock('../../../shared/lib/analytics.ts', () => ({ trackEvent }))

function Consumer() {
  const { job, track, retry, error, refresh, sessionFailure, checkSession } = useGeneration()
  const { pathname } = useLocation()
  return <><div data-testid="job">{job?.status ?? 'none'}</div><div data-testid="progress">{job?.progress?.step ?? 'none'}</div><div>{pathname}</div>
    <div>{error}</div><div data-testid="session-failure">{sessionFailure ?? 'none'}</div>
    <button onClick={() => track({ job_id: 31, status: 'PENDING', guidebook_id: null }, Date.now())}>생성 접수</button>
    <button onClick={() => void retry()}>재시도</button>
    <button onClick={refresh}>상태 다시 확인</button>
    <button onClick={checkSession}>세션 다시 확인</button>
    <Link to="/map">지도 이동</Link><Link to="/preferences">취향 이동</Link>
  </>
}

async function mount() {
  const result = render(<MemoryRouter initialEntries={['/guidebooks']}><GenerationProvider><Consumer /></GenerationProvider></MemoryRouter>)
  await act(async () => {})
  return result
}

function generationEvent(status: string, sequence: number, extras: Record<string, unknown> = {}) {
  return new MessageEvent('generation-status', {
    data: JSON.stringify({
      job_id: 31,
      request_id: '31-0',
      sequence,
      status,
      progress: null,
      guidebook_id: null,
      code: null,
      ...extras,
    }),
  })
}

describe('전역 생성 작업 SSE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getCurrentMember.mockResolvedValue({ member_id: 1, status: 'ACTIVE' })
    getJob.mockResolvedValue({
      job_id: 31,
      status: 'FAILED',
      guidebook_id: null,
      attempt_count: 0,
      error: { code: 'generation_failed', message: '생성에 실패했습니다.', retryable: true },
    })
  })

  it('생성 접수 후 jobId 전용 SSE를 열고 화면 이동에도 유지한다', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    expect(openGenerationStream).toHaveBeenCalledWith(31)

    await act(async () => { fireEvent.click(screen.getByText('지도 이동')) })
    await act(async () => { fireEvent.click(screen.getByText('취향 이동')) })
    expect(openGenerationStream).toHaveBeenCalledTimes(1)
  })

  it('진행 상태를 반영하고 완료 수신 시 연결을 닫는다', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })

    act(() => stream.dispatchEvent(generationEvent('PROCESSING', 1, {
      progress: { step: 'arranging', message: '여행 일정을 구성하고 있어요.' },
    })))
    expect(screen.getByTestId('job')).toHaveTextContent('PROCESSING')
    expect(screen.getByTestId('progress')).toHaveTextContent('arranging')

    act(() => stream.dispatchEvent(generationEvent('COMPLETED', 2, { guidebook_id: 10 })))
    expect(screen.getByTestId('job')).toHaveTextContent('COMPLETED')
    expect(stream.close).toHaveBeenCalled()
    expect(trackEvent).toHaveBeenCalledWith('guidebook_generate_success', {
      generation_time_ms: expect.any(Number),
    })
    expect(localStorage.getItem(jobStorageKey(1))).toBeNull()
  })

  it('새로고침 후 localStorage의 현재 회원 작업을 재구독한다', async () => {
    localStorage.setItem(jobStorageKey(1), JSON.stringify({ job_id: 31 }))
    localStorage.setItem(jobStorageKey(2), JSON.stringify({ job_id: 99 }))

    await mount()

    expect(openGenerationStream).toHaveBeenCalledWith(31)
    expect(openGenerationStream).not.toHaveBeenCalledWith(99)
  })

  it('언마운트 시 전용 SSE를 닫는다', async () => {
    const view = await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })

    view.unmount()

    expect(stream.close).toHaveBeenCalled()
  })

  it('연결 오류를 안내하고 사용자가 새 연결을 열 수 있다', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    act(() => stream.dispatchEvent(new Event('error')))
    expect(screen.getByText(/실시간 상태 연결을 다시 시도/)).toBeInTheDocument()

    await act(async () => { fireEvent.click(screen.getByText('상태 다시 확인')) })
    expect(openGenerationStream).toHaveBeenCalledTimes(2)
  })

  it('FAILED는 버튼으로 같은 작업을 한 번만 재시도한다', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    act(() => stream.dispatchEvent(generationEvent('FAILED', 1)))
    retryJob.mockResolvedValue({ job_id: 31, status: 'PENDING', guidebook_id: null, attempt_count: 1 })

    await act(async () => {
      fireEvent.click(screen.getByText('재시도'))
      fireEvent.click(screen.getByText('재시도'))
    })

    expect(retryJob).toHaveBeenCalledOnce()
    expect(retryJob).toHaveBeenCalledWith(31)
    expect(openGenerationStream).toHaveBeenCalledTimes(2)
  })

  it('회원 조회 401과 일시 오류를 구분하고 재확인한다', async () => {
    getCurrentMember
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new AxiosError(
        '인증 실패',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        { status: 401 } as never,
      ))

    await mount()
    expect(screen.getByTestId('session-failure')).toHaveTextContent('TEMPORARY')

    await act(async () => { fireEvent.click(screen.getByText('세션 다시 확인')) })
    expect(getCurrentMember).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('session-failure')).toHaveTextContent('UNAUTHORIZED')
  })
})
