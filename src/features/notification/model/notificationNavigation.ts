import { routes } from '../../../shared/config/routes.ts'

export const GUIDEBOOK_COMPLETED_NOTIFICATION = 'GUIDEBOOK_COMPLETED'
export const TRIP_STARTING_NOTIFICATION = 'TRIP_STARTING'
export const EVENT_CHANGED_NOTIFICATION = 'EVENT_CHANGED'
export const NEW_EVENTS_ADDED_NOTIFICATION = 'NEW_EVENTS_ADDED'
export const GUIDEBOOK_REFERENCE_TYPE = 'GUIDEBOOK'
export const EVENT_REFERENCE_TYPE = 'EVENT'
export const EVENT_LIST_REFERENCE_TYPE = 'EVENT_LIST'

export type NotificationNavigationState = {
  highlightGuidebookId?: number
  returnTo?: string
}

export type NotificationDestination = {
  pathname: string
  state?: NotificationNavigationState
  actionLabel: '가이드북 보기' | '행사 보기' | '신규 행사 보기'
}

type DestinationOptions = {
  eventReturnTo?: string
}

function positiveInteger(value: string | number): number | null {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function isoDate(value: string | number): string | null {
  const candidate = String(value)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? candidate
    : null
}

export function notificationDestination(
  notificationType: string | null,
  referenceType: string | null,
  referenceId: string | number,
  options: DestinationOptions = {},
): NotificationDestination | null {
  if (
    referenceType === EVENT_LIST_REFERENCE_TYPE &&
    notificationType === NEW_EVENTS_ADDED_NOTIFICATION
  ) {
    const referenceDate = isoDate(referenceId)
    if (!referenceDate) return null
    const search = new URLSearchParams({ view: 'new', date: referenceDate })
    return {
      pathname: `${routes.information}?${search.toString()}`,
      actionLabel: '신규 행사 보기',
    }
  }

  const targetId = positiveInteger(referenceId)
  if (!targetId) return null

  if (referenceType === EVENT_REFERENCE_TYPE && notificationType === EVENT_CHANGED_NOTIFICATION) {
    return {
      pathname: routes.eventDetail.replace(':contentId', String(targetId)),
      state: options.eventReturnTo ? { returnTo: options.eventReturnTo } : undefined,
      actionLabel: '행사 보기',
    }
  }

  if (referenceType !== GUIDEBOOK_REFERENCE_TYPE) return null
  if (notificationType === GUIDEBOOK_COMPLETED_NOTIFICATION) {
    return {
      pathname: routes.guidebookDetail.replace(':guidebookId', String(targetId)),
      actionLabel: '가이드북 보기',
    }
  }

  if (notificationType !== TRIP_STARTING_NOTIFICATION) return null

  return {
    pathname: routes.guidebooks,
    state: { highlightGuidebookId: targetId },
    actionLabel: '가이드북 보기',
  }
}
