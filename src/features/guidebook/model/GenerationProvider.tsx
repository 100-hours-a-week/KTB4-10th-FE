import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getCurrentMember, type CurrentMember } from '../../auth/api/auth.ts'
import {
  classifySessionFailure,
  type SessionFailure,
} from '../../auth/model/sessionFailure.ts'
import { trackEvent } from '../../../shared/lib/analytics.ts'
import { routes } from '../../../shared/config/routes.ts'
import { getJob, openGenerationStream, parseGenerationEvent, retryJob, type Job } from '../api/guidebooks.ts'
import { message } from './conditions.ts'
import { GenerationContext, jobStorageKey } from './generation.ts'

type RestoredGeneration = {
  job: Job
  startedAt: number | null
  reportedTerminal: string | null
}

function restore(memberId: number): RestoredGeneration | null {
  try {
    const value = JSON.parse(localStorage.getItem(jobStorageKey(memberId)) ?? 'null')
    if (!Number.isSafeInteger(value?.job_id) || value.job_id < 1) return null
    // 저장된 상태를 신뢰하지 않고 서버에서 현재 상태를 다시 확인합니다.
    return {
      job: { job_id: value.job_id, status: 'PENDING', guidebook_id: null },
      startedAt: Number.isFinite(value.started_at) ? value.started_at : null,
      reportedTerminal: typeof value.reported_terminal === 'string' ? value.reported_terminal : null,
    }
  } catch { return null }
}

function terminalEventKey(job: Job): string | null {
  if (job.status !== 'COMPLETED' && job.status !== 'FAILED') return null
  return `${job.status}:${job.attempt_count ?? 0}`
}

function attemptFromRequestId(requestId: string): number | undefined {
  const value = Number(requestId.slice(requestId.lastIndexOf('-') + 1))
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function isTerminalStatus(status: Job['status']): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELED'
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionFailure, setSessionFailure] = useState<SessionFailure | null>(null)
  const [sessionRevision, setSessionRevision] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const retryLock = useRef(false)
  const lifecycle = useRef(0)
  const trackedJobId = useRef<number | null>(null)
  const generationStartedAt = useRef<number | null>(null)
  const reportedTerminal = useRef<string | null>(null)
  const latestEvent = useRef<{ jobId: number; attempt: number; sequence: number; status: Job['status'] } | null>(null)
  const { pathname } = useLocation()
  const enabled = pathname !== routes.home && pathname !== routes.about && !pathname.startsWith('/auth') &&
    (pathname !== '/preferences' || member?.status === 'ACTIVE')

  useEffect(() => {
    let active = true
    lifecycle.current += 1
    // 인증 경계가 바뀌면 이전 회원의 작업을 지운 뒤 새 세션과 동기화합니다.
    // oxlint-disable-next-line react/set-state-in-effect
    setMember(null); setJob(null); setError(''); setSessionFailure(null); setChecking(enabled)
    trackedJobId.current = null; generationStartedAt.current = null; reportedTerminal.current = null; latestEvent.current = null
    if (enabled) {
      void getCurrentMember().then((next) => {
        if (!active) return
        setMember(next)
        if (next.status === 'ACTIVE') {
          const restored = restore(next.member_id)
          if (restored) {
            trackedJobId.current = restored.job.job_id
            generationStartedAt.current = restored.startedAt
            reportedTerminal.current = restored.reportedTerminal
            setJob(restored.job)
          }
        }
      }).catch((reason: unknown) => {
        if (active) setSessionFailure(classifySessionFailure(reason))
      }).finally(() => { if (active) setChecking(false) })
    }
    return () => { active = false; lifecycle.current += 1 }
  }, [enabled, sessionRevision])

  useEffect(() => {
    if (!member || !enabled) return
    try {
      if (job && job.status !== 'COMPLETED') {
        localStorage.setItem(jobStorageKey(member.member_id), JSON.stringify({
          job_id: job.job_id,
          started_at: generationStartedAt.current,
          reported_terminal: reportedTerminal.current,
        }))
      }
      else localStorage.removeItem(jobStorageKey(member.member_id))
    } catch { /* 저장소가 차단돼도 현재 앱의 생성 상태 수신은 유지합니다. */ }
  }, [job, member, enabled])

  const track = useCallback((next: Job, startedAt?: number) => {
    if (trackedJobId.current !== next.job_id) {
      trackedJobId.current = next.job_id
      generationStartedAt.current = startedAt ?? null
      reportedTerminal.current = null
      latestEvent.current = null
    } else if (startedAt !== undefined) {
      generationStartedAt.current = startedAt
    }
    setJob(next); setError(''); setRevision((value) => value + 1)
  }, [])
  const dismiss = useCallback(() => {
    trackedJobId.current = null; generationStartedAt.current = null; reportedTerminal.current = null; latestEvent.current = null
    setJob(null); setError('')
  }, [])
  const refresh = useCallback(() => {
    setError('')
    setRevision((value) => value + 1)
  }, [])
  const jobId = job?.job_id
  const memberStatus = member?.status

  useEffect(() => {
    if (!jobId || !enabled || memberStatus !== 'ACTIVE') return
    const controller = new AbortController()
    const stream = openGenerationStream(jobId)
    const handleStatus = (raw: Event) => {
      const event = parseGenerationEvent((raw as MessageEvent<string>).data)
      if (!event || event.job_id !== jobId) return
      const attempt = attemptFromRequestId(event.request_id) ?? 0
      const previous = latestEvent.current
      if (previous?.jobId === jobId && (attempt < previous.attempt
        || (attempt === previous.attempt && (isTerminalStatus(previous.status)
          || (!isTerminalStatus(event.status) && event.sequence <= previous.sequence))))) return
      latestEvent.current = { jobId, attempt, sequence: event.sequence, status: event.status }
      const next: Job = {
        job_id: jobId,
        status: event.status,
        guidebook_id: event.guidebook_id,
        attempt_count: attempt,
        request_id: event.request_id,
        sequence: event.sequence,
        progress: event.progress,
      }
      const eventKey = terminalEventKey(next)
      if (eventKey && eventKey !== reportedTerminal.current && generationStartedAt.current !== null) {
        reportedTerminal.current = eventKey
        trackEvent(
          next.status === 'COMPLETED' ? 'guidebook_generate_success' : 'guidebook_generate_fail',
          { generation_time_ms: Math.max(0, Date.now() - generationStartedAt.current) },
        )
      }
      setJob(next); setError('')
      if (isTerminalStatus(next.status)) {
        stream.close()
        if (next.status === 'FAILED') {
          void getJob(jobId, controller.signal).then((terminal) => {
            if (!controller.signal.aborted) setJob(terminal)
          }).catch(() => undefined)
        }
      }
    }
    const handleError = () => setError('실시간 상태 연결을 다시 시도하고 있어요.')
    stream.addEventListener('generation-status', handleStatus)
    stream.addEventListener('error', handleError)
    return () => {
      controller.abort()
      stream.removeEventListener('generation-status', handleStatus)
      stream.removeEventListener('error', handleError)
      stream.close()
    }
  }, [jobId, enabled, memberStatus, revision])

  async function retry() {
    if (!job || retryLock.current || job.status !== 'FAILED' || (job.attempt_count ?? 3) >= 3) return
    retryLock.current = true; setBusy(true); setError('')
    const current = lifecycle.current
    try {
      const next = await retryJob(job.job_id)
      if (current === lifecycle.current) track(next)
    } catch (reason) {
      if (current === lifecycle.current) {
        setError(message(reason))
        // POST 응답 유실 가능성 때문에 자동 POST 재전송 대신 상태 조회를 다시 합니다.
        setRevision((value) => value + 1)
      }
    } finally { retryLock.current = false; setBusy(false) }
  }

  return <GenerationContext.Provider value={{
    member, checking, sessionFailure, checkSession: () => setSessionRevision((value) => value + 1),
    job, error, busy, track, retry, dismiss,
    refresh,
  }}>{children}</GenerationContext.Provider>
}
