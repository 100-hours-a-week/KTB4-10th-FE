import { useEffect, useState } from 'react'
import type { RegenerationAvailability } from '../api/guidebooks.ts'

export type RegenerationState = {
  available: boolean
  reason: 'exhausted' | 'expired' | 'unavailable' | null
}

export function getRegenerationState(
  regeneration: RegenerationAvailability,
  now = Date.now(),
): RegenerationState {
  if (regeneration.remaining_count <= 0) return { available: false, reason: 'exhausted' }

  const expiresAt = regeneration.expires_at ? Date.parse(regeneration.expires_at) : Number.NaN
  if (Number.isFinite(expiresAt) && now >= expiresAt) return { available: false, reason: 'expired' }
  if (!regeneration.available) return { available: false, reason: 'unavailable' }
  return { available: true, reason: null }
}

export function useRegenerationState(regeneration: RegenerationAvailability | null) {
  const [deadlineTick, setDeadlineTick] = useState(0)

  useEffect(() => {
    if (!regeneration?.expires_at) return
    const expiresAt = Date.parse(regeneration.expires_at)
    if (!Number.isFinite(expiresAt)) return
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(
      () => setDeadlineTick((value) => value + 1),
      Math.min(remaining + 50, 2_147_483_647),
    )
    return () => window.clearTimeout(timer)
  }, [deadlineTick, regeneration?.expires_at])

  return regeneration ? getRegenerationState(regeneration) : null
}

export function regenerationUnavailableMessage(reason: RegenerationState['reason']) {
  if (reason === 'exhausted') return '가이드북 재생성 가능 횟수를 모두 사용했어요.'
  if (reason === 'expired') return '가이드북 재생성 가능 시간이 지났어요.'
  return '재생성 가능 여부를 확인하지 못했어요.'
}
