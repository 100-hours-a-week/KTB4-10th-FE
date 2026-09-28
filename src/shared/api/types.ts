export type ApiResponse<T> = {
  message: string
  data: T
}

export type ErrorDetail = {
  field: string
  reason: string
}

export type ErrorPayload = {
  code: string
  details: ErrorDetail[]
  trace_id: string
}

export type ErrorResponse = {
  message: string
  data: null
  error: ErrorPayload
}

export type ApiResult<T> = ApiResponse<T> | ErrorResponse

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isErrorDetail(value: unknown): value is ErrorDetail {
  return (
    isRecord(value) &&
    typeof value.field === 'string' &&
    typeof value.reason === 'string'
  )
}

export function isApiResponse<T = unknown>(
  value: unknown,
): value is ApiResponse<T> {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    hasOwn(value, 'data') &&
    !hasOwn(value, 'error')
  )
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (
    !isRecord(value) ||
    typeof value.message !== 'string' ||
    value.data !== null ||
    !isRecord(value.error)
  ) {
    return false
  }

  const { error } = value

  return (
    typeof error.code === 'string' &&
    Array.isArray(error.details) &&
    error.details.every(isErrorDetail) &&
    typeof error.trace_id === 'string'
  )
}
