import { createContext, useContext } from 'react'
import type { CurrentMember } from '../../auth/api/auth.ts'
import type { Job } from '../api/guidebooks.ts'

export const jobStorageKey = (memberId: number) => `kgb.guidebook.job.${memberId}`
export const isRunning = (job: Job | null) => job?.status === 'PENDING' || job?.status === 'PROCESSING'
export const GenerationContext = createContext<{
  member: CurrentMember | null
  checking: boolean
  sessionError: string
  checkSession: () => void
  job: Job | null
  error: string
  busy: boolean
  track: (job: Job) => void
  retry: () => Promise<void>
  refresh: () => void
  dismiss: () => void
} | null>(null)

export function useGeneration() {
  const context = useContext(GenerationContext)
  if (!context) throw new Error('GenerationProvider가 필요합니다.')
  return context
}
