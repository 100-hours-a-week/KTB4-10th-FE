import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CouponRedemptionError, redeemCoupon } from '../api/coupons.ts'
import { CouponPage } from './CouponPage.tsx'

vi.mock('../api/coupons.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/coupons.ts')>()
  return { ...actual, redeemCoupon: vi.fn() }
})

const redeemCouponMock = vi.mocked(redeemCoupon)

describe('CouponPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('등록 후 충전된 생성권과 잔액을 표시한다', async () => {
    const user = userEvent.setup()
    redeemCouponMock.mockResolvedValue({ granted_credits: 2, credit_balance: 5 })
    render(<MemoryRouter><CouponPage /></MemoryRouter>)

    const submit = screen.getByRole('button', { name: '쿠폰 등록하기' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('쿠폰 번호'), ' secret-2026 ')
    await user.click(submit)

    expect(redeemCouponMock).toHaveBeenCalledWith('secret-2026')
    expect(await screen.findByText('생성권 2개가 충전됐어요')).toBeInTheDocument()
    expect(screen.getByText('5개')).toBeInTheDocument()
  })

  it('이미 등록한 쿠폰 오류를 표시한다', async () => {
    const user = userEvent.setup()
    redeemCouponMock.mockRejectedValue(new CouponRedemptionError('COUPON_ALREADY_REDEEMED'))
    render(<MemoryRouter><CouponPage /></MemoryRouter>)

    await user.type(screen.getByLabelText('쿠폰 번호'), 'SECRET-2026')
    await user.click(screen.getByRole('button', { name: '쿠폰 등록하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 사용한 쿠폰이에요.')
  })
})
