import { routes } from '../../../shared/config/routes.ts'

export const GUIDEBOOK_COMPLETED_NOTIFICATION = 'GUIDEBOOK_COMPLETED'

export type GuidebookNavigationState = {
  highlightGuidebookId: number
}

export type GuidebookNotificationDestination = {
  pathname: string
  state?: GuidebookNavigationState
}

export function guidebookNotificationDestination(
  notificationType: string | null,
  guidebookId: number,
): GuidebookNotificationDestination {
  if (notificationType === GUIDEBOOK_COMPLETED_NOTIFICATION) {
    return {
      pathname: routes.guidebookDetail.replace(':guidebookId', String(guidebookId)),
    }
  }

  return {
    pathname: routes.guidebooks,
    state: { highlightGuidebookId: guidebookId },
  }
}
