import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { PageHeader } from '../../../shared/ui/PageHeader.tsx'
import { CouponRedemptionError, redeemCoupon } from '../api/coupons.ts'
import './coupon-page.css'

const RATE_LIMIT_FALLBACK_SECONDS = 10 * 60

function errorMessage(code: string) {
  if (code === 'COUPON_INVALID') return '쿠폰 번호를 다시 확인해 주세요.'
  if (code === 'COUPON_ALREADY_REDEEMED') return '이미 사용한 쿠폰이에요.'
  if (code === 'COUPON_UNAVAILABLE') return '지금은 쿠폰을 등록할 수 없어요.'
  return '쿠폰을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

function remainingTimeText(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes === 0) return `${remainingSeconds}초`
  if (remainingSeconds === 0) return `${minutes}분`
  return `${minutes}분 ${remainingSeconds}초`
}

export function CouponPage() {
  const navigate = useNavigate()
  const [couponCode, setCouponCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ granted: number; balance: number } | null>(null)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const isRateLimited = blockedUntil !== null && remainingSeconds > 0

  useEffect(() => {
    if (blockedUntil === null) return undefined
    const intervalId = window.setInterval(() => {
      const nextSeconds = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000))
      setRemainingSeconds(nextSeconds)
      if (nextSeconds === 0) {
        setBlockedUntil(null)
        setError(null)
      }
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [blockedUntil])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedCode = couponCode.trim()
    if (!trimmedCode || isSubmitting || isRateLimited) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await redeemCoupon(trimmedCode)
      setSuccess({ granted: result.granted_credits, balance: result.credit_balance })
      setCouponCode('')
    } catch (requestError) {
      const code = requestError instanceof CouponRedemptionError ? requestError.code : 'NETWORK_ERROR'
      if (code === 'RATE_LIMIT_EXCEEDED') {
        const retryAfter = requestError instanceof CouponRedemptionError
          ? requestError.retryAfterSeconds
          : null
        const blockSeconds = retryAfter ?? RATE_LIMIT_FALLBACK_SECONDS
        setBlockedUntil(Date.now() + blockSeconds * 1000)
        setRemainingSeconds(blockSeconds)
        setError(null)
      } else {
        setError(errorMessage(code))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell coupon-page">
      <PageHeader
        title="쿠폰 등록"
        leading={<button className="coupon-page__back" type="button" aria-label="마이페이지로 돌아가기" onClick={() => navigate(routes.myPage)}>‹</button>}
      />

      <div className="coupon-page__content">
        {success ? (
          <section className="coupon-result" aria-live="polite">
            <span className="coupon-result__icon" aria-hidden="true">✓</span>
            <h2>생성권 {success.granted}개가 충전됐어요</h2>
            <p>현재 보유 생성권은 <strong>{success.balance}개</strong>예요.</p>
            <button className="coupon-primary-button" type="button" onClick={() => navigate(routes.myPage)}>확인</button>
          </section>
        ) : (
          <section className="coupon-card" aria-labelledby="coupon-title">
            <h2 id="coupon-title">쿠폰 번호를 입력해 주세요</h2>
            <p>유효한 쿠폰은 계정당 한 번만 사용할 수 있어요.</p>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <label htmlFor="coupon-code">쿠폰 번호</label>
              <input
                id="coupon-code"
                type="text"
                value={couponCode}
                maxLength={100}
                disabled={isSubmitting || isRateLimited}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="쿠폰 번호 입력"
                aria-describedby={error || isRateLimited ? 'coupon-error' : undefined}
                onChange={(event) => setCouponCode(event.target.value)}
              />
              {error && <p id="coupon-error" className="coupon-form-error" role="alert">{error}</p>}
              {isRateLimited && (
                <p id="coupon-error" className="coupon-form-error">
                  <span role="alert">쿠폰 입력이 잠시 제한 됐어요</span>
                  <br />
                  <span aria-hidden="true">{remainingTimeText(remainingSeconds)} 후 다시 시도해 주세요.</span>
                  <span className="visually-hidden">잠시 후 다시 시도해 주세요.</span>
                </p>
              )}
              <button className="coupon-primary-button" type="submit" disabled={!couponCode.trim() || isSubmitting || isRateLimited}>
                {isSubmitting ? '등록 중...' : '쿠폰 등록하기'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}
