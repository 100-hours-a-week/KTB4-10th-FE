export const NOTIFICATIONS_UPDATED_EVENT = 'kgb:notifications-updated'
export const REALTIME_NOTIFICATION_SETTING_CHANGED_EVENT =
  'kgb:realtime-notification-setting-changed'

export type NotificationsUpdatedDetail = {
  unreadCount: number
}

export type RealtimeNotificationSettingChangedDetail = {
  enabled: boolean
}

export function notifyNotificationsUpdated(unreadCount: number) {
  window.dispatchEvent(new CustomEvent<NotificationsUpdatedDetail>(
    NOTIFICATIONS_UPDATED_EVENT,
    { detail: { unreadCount } },
  ))
}

export function notifyRealtimeNotificationSettingChanged(enabled: boolean) {
  window.dispatchEvent(new CustomEvent<RealtimeNotificationSettingChangedDetail>(
    REALTIME_NOTIFICATION_SETTING_CHANGED_EVENT,
    { detail: { enabled } },
  ))
}
