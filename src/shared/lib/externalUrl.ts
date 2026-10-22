const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"']+/i
const TRAILING_PUNCTUATION_PATTERN = /[),.;\]}]+$/u

export function extractExternalHttpUrl(value: string | null | undefined): string | null {
  const matched = value?.match(HTTP_URL_PATTERN)?.[0]
  if (!matched) return null

  const candidate = matched.replace(TRAILING_PUNCTUATION_PATTERN, '')
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : null
  } catch {
    return null
  }
}
