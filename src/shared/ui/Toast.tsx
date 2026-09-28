import { useEffect } from 'react'

type ToastProps = {
  message: string
  onDismiss?: () => void
  duration?: number
}

export function Toast({ message, onDismiss, duration = 2400 }: ToastProps) {
  useEffect(() => {
    if (!onDismiss) return undefined

    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [duration, message, onDismiss])

  return (
    <div className="app-toast" role="status" aria-label={message}>
      {message}
    </div>
  )
}
