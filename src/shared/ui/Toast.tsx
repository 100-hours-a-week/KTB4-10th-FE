import { useEffect, useState } from 'react'

type ToastProps = {
  message: string
  onDismiss?: () => void
  duration?: number
  onAction?: () => void
  actionLabel?: string
  actionDisabled?: boolean
}

const EXIT_ANIMATION_DURATION = 180

export function Toast({
  message,
  onDismiss,
  duration = 1600,
  onAction,
  actionLabel,
  actionDisabled = false,
}: ToastProps) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!onDismiss || actionDisabled) return undefined

    const closingTimer = window.setTimeout(
      () => setIsClosing(true),
      duration - EXIT_ANIMATION_DURATION,
    )
    const dismissTimer = window.setTimeout(onDismiss, duration)
    return () => {
      window.clearTimeout(closingTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [actionDisabled, duration, message, onDismiss])

  return (
    <div
      className={`app-toast${isClosing ? ' app-toast--closing' : ''}`}
      role="status"
      aria-label={message}
    >
      <span>{message}</span>
      {onAction && actionLabel && (
        <button type="button" disabled={actionDisabled} onClick={onAction}>
          {actionDisabled ? '처리 중...' : actionLabel}
        </button>
      )}
    </div>
  )
}
