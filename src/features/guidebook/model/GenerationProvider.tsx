import axios from 'axios'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getCurrentMember, type CurrentMember } from '../../auth/api/auth.ts'
import { getJob, retryJob, type Job } from '../api/guidebooks.ts'
import { message } from './conditions.ts'
import { GenerationContext, isRunning, jobStorageKey } from './generation.ts'

function restore(memberId: number): Job | null {
  try {
    const value = JSON.parse(localStorage.getItem(jobStorageKey(memberId)) ?? 'null')
    if (!Number.isSafeInteger(value?.job_id) || value.job_id < 1) return null
    // 저장된 상태를 신뢰하지 않고 서버에서 현재 상태를 다시 확인합니다.
    return { job_id: value.job_id, status: 'PENDING', guidebook_id: null }
  } catch { return null }
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionRevision, setSessionRevision] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const retryLock = useRef(false)
  const lifecycle = useRef(0)
  const { pathname } = useLocation()
  const enabled = pathname !== '/' && !pathname.startsWith('/auth') &&
    (pathname !== '/preferences' || member?.status === 'ACTIVE')

  useEffect(() => {
    let active = true
    lifecycle.current += 1
    // 인증 경계가 바뀌면 이전 회원의 작업을 지운 뒤 새 세션과 동기화합니다.
    // oxlint-disable-next-line react/set-state-in-effect
    setMember(null); setJob(null); setError(''); setSessionError(''); setChecking(enabled)
    if (enabled) {
      void getCurrentMember().then((next) => {
        if (!active) return
        setMember(next)
        if (next.status === 'ACTIVE') setJob(restore(next.member_id))
      }).catch((reason: unknown) => {
        if (active) setSessionError(message(reason))
      }).finally(() => { if (active) setChecking(false) })
    }
    return () => { active = false; lifecycle.current += 1 }
  }, [enabled, sessionRevision])

  useEffect(() => {
    if (!member || !enabled) return
    try {
      if (job && job.status !== 'COMPLETED') {
        localStorage.setItem(jobStorageKey(member.member_id), JSON.stringify({ job_id: job.job_id }))
      }
      else localStorage.removeItem(jobStorageKey(member.member_id))
    } catch { /* 저장소 차단 시 현재 앱에서의 생성과 폴링은 유지합니다. */ }
  }, [job, member, enabled])

  const track = useCallback((next: Job) => {
    setJob(next); setError(''); setRevision((value) => value + 1)
  }, [])
  const dismiss = useCallback(() => { setJob(null); setError('') }, [])
  const jobId = job?.job_id

  useEffect(() => {
    if (!jobId || !enabled || member?.status !== 'ACTIVE') return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const next = await getJob(jobId!, controller.signal)
        if (controller.signal.aborted) return
        setJob(next); setError('')
        if (isRunning(next)) timer = setTimeout(poll, 2000)
      } catch (reason) {
        if (controller.signal.aborted) return
        const status = axios.isAxiosError(reason) ? reason.response?.status : undefined
        if (status === 401) {
          setSessionError('로그인이 만료되었어요. 다시 로그인해 주세요.')
          setMember(null); setJob(null)
        } else if (status === 403 || status === 404) {
          setJob(null); setError(message(reason))
        } else {
          setError('진행 상태를 확인하지 못했어요. 상태 다시 확인을 눌러 주세요.')
        }
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
    // 상태 응답과 내부 화면 전환으로 루프를 재시작하지 않습니다.
  }, [jobId, enabled, member?.member_id, member?.status, revision])

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
    member, checking, sessionError, checkSession: () => setSessionRevision((value) => value + 1),
    job, error, busy, track, retry, dismiss,
    refresh: () => { setError(''); setRevision((value) => value + 1) },
  }}>{children}</GenerationContext.Provider>
}
