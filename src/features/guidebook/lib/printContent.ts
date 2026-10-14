const BLOCKED_ELEMENTS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'base',
  'meta[http-equiv]',
].join(',')

const PRINT_STYLE = `
  html {
    -webkit-text-size-adjust: 100%;
  }

  img,
  svg,
  video,
  canvas,
  table {
    max-width: 100%;
  }

  body {
    overflow-wrap: anywhere;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
    }

    * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

function isSafeResourceUrl(value: string): boolean {
  const normalized = value.trim()
  if (normalized.startsWith('#')) return true

  try {
    const url = new URL(normalized, window.location.origin)
    return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol)
  } catch {
    return false
  }
}

function removeUnsafeAttributes(element: Element): void {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc') {
      element.removeAttribute(attribute.name)
      continue
    }

    if (['src', 'href', 'poster', 'xlink:href'].includes(name)
      && !isSafeResourceUrl(attribute.value)) {
      element.removeAttribute(attribute.name)
    }
  }
}

export function sanitizeGuidebookForPrint(contentHtml: string): string {
  const document = new DOMParser().parseFromString(contentHtml, 'text/html')
  document.querySelectorAll(BLOCKED_ELEMENTS).forEach((element) => element.remove())
  document.querySelectorAll('link').forEach((element) => {
    if (element.rel.toLowerCase() !== 'stylesheet') element.remove()
  })
  document.querySelectorAll('*').forEach(removeUnsafeAttributes)
  document.querySelectorAll('img').forEach((image) => {
    image.setAttribute('loading', 'eager')
  })

  const viewport = document.createElement('meta')
  viewport.name = 'viewport'
  viewport.content = 'width=device-width, initial-scale=1'
  document.head.prepend(viewport)

  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = [
    "default-src 'none'",
    "img-src http: https: data: blob:",
    "style-src 'unsafe-inline' http: https:",
    'font-src http: https: data:',
    "script-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  document.head.prepend(policy)

  const printStyle = document.createElement('style')
  printStyle.dataset.kgbPrint = 'true'
  printStyle.textContent = PRINT_STYLE
  document.head.append(printStyle)

  return `<!doctype html>\n${document.documentElement.outerHTML}`
}

export async function waitForPrintAssets(document: Document, timeoutMs = 10000): Promise<void> {
  const imageWaits = [...document.images].map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })
  })
  const fontWait = document.fonts?.ready ?? Promise.resolve()
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))

  await Promise.race([
    Promise.all([fontWait, ...imageWaits]).then(() => undefined),
    timeout,
  ])
}
