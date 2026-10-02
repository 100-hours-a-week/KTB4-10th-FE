import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerationProvider } from './GenerationProvider.tsx'
import { jobStorageKey, useGeneration } from './generation.ts'

const { getCurrentMember, getJob, retryJob, trackEvent } = vi.hoisted(() => ({
  getCurrentMember: vi.fn(), getJob: vi.fn(), retryJob: vi.fn(), trackEvent: vi.fn(),
}))
vi.mock('../../auth/api/auth.ts', () => ({ getCurrentMember }))
vi.mock('../api/guidebooks.ts', () => ({ getJob, retryJob }))
vi.mock('../../../shared/lib/analytics.ts', () => ({ trackEvent }))

function Consumer() {
  const { job, track, retry, error, refresh } = useGeneration()
  const { pathname } = useLocation()
  return <><div data-testid="job">{job?.status ?? 'none'}</div><div>{pathname}</div>
    <div>{error}</div>
    <button onClick={() => track({ job_id: 31, status: 'PENDING', guidebook_id: null }, Date.now())}>생성 접수</button>
    <button onClick={() => void retry()}>재시도</button>
    <button onClick={refresh}>조회 재개</button>
    <Link to="/map">지도 이동</Link><Link to="/preferences">취향 이동</Link><Link to="/">로그아웃 이동</Link>
  </>
}
async function mount() {
  const result = render(<MemoryRouter initialEntries={['/guidebooks']}><GenerationProvider><Consumer /></GenerationProvider></MemoryRouter>)
  await act(async () => {})
  return result
}

describe('전역 생성 작업', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    getCurrentMember.mockResolvedValue({ member_id: 1, status: 'ACTIVE' })
    getJob.mockResolvedValue({ job_id: 31, status: 'PROCESSING', guidebook_id: null, attempt_count: 0 })
  })
  afterEach(() => { vi.useRealTimers() })

  it('화면과 취향 화면을 이동해도 하나의 루프로 계속 조회하고 완료하면 멈춘다', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    expect(getJob).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(screen.getByText('지도 이동')) })
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(getJob).toHaveBeenCalledTimes(2)
    await act(async () => { fireEvent.click(screen.getByText('취향 이동')) })
    getJob.mockResolvedValue({ job_id: 31, status: 'COMPLETED', guidebook_id: 10, attempt_count: 0 })
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(screen.getByTestId('job')).toHaveTextContent('COMPLETED')
    expect(localStorage.getItem(jobStorageKey(1))).toBeNull()
    expect(trackEvent).toHaveBeenCalledWith('guidebook_generate_success', {
      generation_time_ms: expect.any(Number),
    })
    await act(async () => { vi.advanceTimersByTime(20000) })
    expect(getJob).toHaveBeenCalledTimes(3)
    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(retryJob).not.toHaveBeenCalled()
  })

  it('FAILED는 자동 재시도하지 않고 버튼으로 같은 작업을 재시도한다', async () => {
    getJob.mockResolvedValue({ job_id: 31, status: 'FAILED', guidebook_id: null, attempt_count: 1 })
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    await act(async () => { vi.advanceTimersByTime(20000) })
    expect(getJob).toHaveBeenCalledTimes(1)
    expect(retryJob).not.toHaveBeenCalled()
    retryJob.mockResolvedValue({ job_id: 31, status: 'PENDING', guidebook_id: null })
    getJob.mockResolvedValue({ job_id: 31, status: 'PROCESSING', guidebook_id: null, attempt_count: 2 })
    await act(async () => { fireEvent.click(screen.getByText('재시도')); fireEvent.click(screen.getByText('재시도')) })
    expect(retryJob).toHaveBeenCalledTimes(1)
    expect(retryJob).toHaveBeenCalledWith(31)
    expect(screen.getByTestId('job')).toHaveTextContent('PROCESSING')
  })

  it('새로고침 후 현재 회원의 작업만 복구한다', async () => {
    localStorage.setItem(jobStorageKey(1), JSON.stringify({ job_id: 31 }))
    localStorage.setItem(jobStorageKey(2), JSON.stringify({ job_id: 99 }))
    await mount()
    expect(getJob).toHaveBeenCalledWith(31, expect.any(AbortSignal))
    expect(getJob).not.toHaveBeenCalledWith(99, expect.anything())
  })

  it('느린 요청은 중첩하지 않고 앱 종료 시 요청을 취소한다', async () => {
    getJob.mockImplementation(() => new Promise(() => {}))
    const result = await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    await act(async () => { vi.advanceTimersByTime(10000) })
    expect(getJob).toHaveBeenCalledTimes(1)
    const signal = getJob.mock.calls[0][1] as AbortSignal
    result.unmount()
    expect(signal.aborted).toBe(true)
  })

  it.each(['CANCELED', 'FAILED'])('%s 종료 상태에서 자동 조회를 멈추고 한도 초과 재시도를 막는다', async (status) => {
    getJob.mockResolvedValue({ job_id: 31, status, guidebook_id: null, attempt_count: 3 })
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    await act(async () => { vi.advanceTimersByTime(10000); fireEvent.click(screen.getByText('재시도')) })
    expect(getJob).toHaveBeenCalledTimes(1)
    expect(retryJob).not.toHaveBeenCalled()
  })

  it('조회 오류 후 사용자가 조회를 재개할 수 있다', async () => {
    getJob.mockRejectedValueOnce(new Error('network'))
    await mount()
    await act(async () => { fireEvent.click(screen.getByText('생성 접수')) })
    expect(screen.getByText(/진행 상태를 확인하지 못했어요/)).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(10000) })
    expect(getJob).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(screen.getByText('조회 재개')) })
    expect(getJob).toHaveBeenCalledTimes(2)
  })
})
