const SERVICE_WORKER_URL = '/service-worker.js'
const SERVICE_WORKER_SCOPE = '/'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function supportsServiceWorker(): boolean {
  const secureContext = window.isSecureContext || LOCAL_HOSTS.has(window.location.hostname)
  return secureContext && 'serviceWorker' in navigator
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsServiceWorker()) return null

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      updateViaCache: 'none',
    })
    void registration.update().catch(() => undefined)
    return registration
  } catch {
    // PWA 기능은 점진적 향상이므로 등록 실패가 기존 웹 앱 실행을 막지 않습니다.
    return null
  }
}

export function scheduleServiceWorkerRegistration(): void {
  if (!supportsServiceWorker()) return

  const register = () => {
    void registerServiceWorker()
  }

  if (document.readyState === 'complete') {
    register()
    return
  }
  window.addEventListener('load', register, { once: true })
}
