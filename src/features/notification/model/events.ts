export const NOTIFICATIONS_UPDATED_EVENT = 'kgb:notifications-updated'

export type NotificationsUpdatedDetail = {
  unreadCount: number
}

export function notifyNotificationsUpdated(unreadCount: number) {
  window.dispatchEvent(new CustomEvent<NotificationsUpdatedDetail>(
    NOTIFICATIONS_UPDATED_EVENT,
    { detail: { unreadCount } },
  ))
}
