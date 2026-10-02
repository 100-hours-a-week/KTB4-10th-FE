import * as Sentry from '@sentry/react'

function removeQuery(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return rawUrl.split('?')[0]
  }
}

export function initializeSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()

  Sentry.init({
    dsn,
    enabled: import.meta.env.PROD && Boolean(dsn),
    environment: import.meta.env.MODE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend(event) {
      // 회원 ID를 포함해 사용자를 직접 식별할 수 있는 값을 전송하지 않습니다.
      event.user = undefined

      if (event.request?.url) {
        event.request.url = removeQuery(event.request.url)
      }
      if (event.request) {
        event.request.query_string = undefined
      }

      return event
    },
    beforeBreadcrumb(breadcrumb) {
      if (typeof breadcrumb.data?.url === 'string') {
        breadcrumb.data.url = removeQuery(breadcrumb.data.url)
      }
      return breadcrumb
    },
  })
}
