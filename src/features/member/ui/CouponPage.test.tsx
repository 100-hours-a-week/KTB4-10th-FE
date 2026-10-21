import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CouponRedemptionError, redeemCoupon } from '../api/coupons.ts'
import { CouponPage } from './CouponPage.tsx'

vi.mock('../api/coupons.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/coupons.ts')>()
  return { ...actual, redeemCoupon: vi.fn() }
})

const redeemCouponMock = vi.mocked(redeemCoupon)

describe('CouponPage', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

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

  it('입력 제한 중 남은 시간을 표시하고 만료 후 자동으로 다시 활성화한다', async () => {
    vi.useFakeTimers()
    redeemCouponMock.mockRejectedValue(new CouponRedemptionError('RATE_LIMIT_EXCEEDED', 95))
    render(<MemoryRouter><CouponPage /></MemoryRouter>)

    const input = screen.getByLabelText('쿠폰 번호')
    const submit = screen.getByRole('button', { name: '쿠폰 등록하기' })
    fireEvent.change(input, { target: { value: 'WRONG-CODE' } })
    await act(async () => {
      fireEvent.click(submit)
      await Promise.resolve()
    })

    expect(screen.getByText(/1분 35초 후 다시 시도해 주세요/)).toBeInTheDocument()
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: '쿠폰 등록하기' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }))
    expect(redeemCouponMock).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(95_000))

    expect(input).toBeEnabled()
    expect(screen.getByRole('button', { name: '쿠폰 등록하기' })).toBeEnabled()
    expect(screen.queryByText(/쿠폰 입력이 잠시 제한 됐어요/)).not.toBeInTheDocument()
  })

  it('제한 중 화면을 벗어나면 카운트다운 타이머를 정리한다', async () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    redeemCouponMock.mockRejectedValue(new CouponRedemptionError('RATE_LIMIT_EXCEEDED', null))
    const view = render(<MemoryRouter><CouponPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('쿠폰 번호'), { target: { value: 'WRONG-CODE' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }))
      await Promise.resolve()
    })

    expect(screen.getByText(/10분 후 다시 시도해 주세요/)).toBeInTheDocument()
    view.unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
