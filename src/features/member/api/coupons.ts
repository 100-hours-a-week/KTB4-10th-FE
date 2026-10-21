import axios from 'axios'
import { http } from '../../../shared/api/http.ts'
import { isApiResponse, isErrorResponse } from '../../../shared/api/types.ts'

export type CouponRedemption = {
  granted_credits: number
  credit_balance: number
}

export class CouponRedemptionError extends Error {
  readonly code: string
  readonly retryAfterSeconds: number | null

  constructor(code: string, retryAfterSeconds: number | null = null) {
    super(code)
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function parseRetryAfterSeconds(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.ceil(seconds)
}

export async function redeemCoupon(couponCode: string): Promise<CouponRedemption> {
  try {
    const response = await http.post('/api/v1/credits/coupons/redeem', { coupon_code: couponCode })
    const redemption = response.data?.data
    if (!isApiResponse(response.data) || !redemption ||
      !Number.isSafeInteger(redemption.granted_credits) || redemption.granted_credits <= 0 ||
      !Number.isSafeInteger(redemption.credit_balance) || redemption.credit_balance < 0) {
      throw new CouponRedemptionError('INVALID_RESPONSE')
    }
    return redemption
  } catch (error) {
    if (error instanceof CouponRedemptionError) throw error
    if (axios.isAxiosError(error) && isErrorResponse(error.response?.data)) {
      const code = error.response.data.error.code
      const retryAfter = code === 'RATE_LIMIT_EXCEEDED'
        ? parseRetryAfterSeconds(error.response?.headers?.['retry-after'])
        : null
      throw new CouponRedemptionError(code, retryAfter)
    }
    throw new CouponRedemptionError('NETWORK_ERROR')
  }
}
