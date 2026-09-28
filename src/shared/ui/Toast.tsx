import { useEffect, useState } from 'react'

type ToastProps = {
  message: string
  onDismiss?: () => void
  duration?: number
}

const EXIT_ANIMATION_DURATION = 180

export function Toast({ message, onDismiss, duration = 1600 }: ToastProps) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!onDismiss) return undefined

    const closingTimer = window.setTimeout(
      () => setIsClosing(true),
      duration - EXIT_ANIMATION_DURATION,
    )
    const dismissTimer = window.setTimeout(onDismiss, duration)
    return () => {
      window.clearTimeout(closingTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [duration, message, onDismiss])

  return (
    <div
      className={`app-toast${isClosing ? ' app-toast--closing' : ''}`}
      role="status"
      aria-label={message}
    >
      {message}
    </div>
  )
}
