import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  isApiResponse,
  isErrorResponse,
  type ApiResponse,
  type ErrorResponse,
} from './types.ts'

describe('공통 API 응답 타입 가드', () => {
  it('성공 응답을 판별하고 제네릭 data 타입을 좁힌다', () => {
    const response: unknown = {
      message: 'member_get_success',
      data: { member_id: 1 },
    }

    expect(isApiResponse<{ member_id: number }>(response)).toBe(true)

    if (isApiResponse<{ member_id: number }>(response)) {
      expect(response.data.member_id).toBe(1)
      expectTypeOf(response).toEqualTypeOf<
        ApiResponse<{ member_id: number }>
      >()
    }
  })

  it('백엔드 오류 응답의 null data와 상세 필드를 판별한다', () => {
    const response: unknown = {
      message: '요청값을 확인해 주세요.',
      data: null,
      error: {
        code: 'COMMON_VALIDATION_ERROR',
        details: [{ field: 'nickname', reason: 'NotBlank' }],
        trace_id: 'trace-123',
      },
    }

    expect(isErrorResponse(response)).toBe(true)

    if (isErrorResponse(response)) {
      expect(response.error.details).toHaveLength(1)
      expectTypeOf(response).toEqualTypeOf<ErrorResponse>()
    }
  })

  it.each([
    null,
    { message: 'success' },
    { message: 'success', data: null, error: null },
    {
      message: 'error',
      data: null,
      error: { code: 'ERROR', details: [], traceId: 'wrong-key' },
    },
    {
      message: 'error',
      data: null,
      error: {
        code: 'ERROR',
        details: [{ field: 'name' }],
        trace_id: 'trace-123',
      },
    },
  ])('잘못된 응답 형태를 거부한다: %o', (response) => {
    expect(isApiResponse(response)).toBe(false)
    expect(isErrorResponse(response)).toBe(false)
  })
})
