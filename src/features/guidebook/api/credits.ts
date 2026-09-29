import { http } from '../../../shared/api/http.ts'
import { isApiResponse } from '../../../shared/api/types.ts'

export type CreditWallet = {
  credit_balance: number
  active_job_id: number | null
  can_generate: boolean
}

export async function getCreditWallet(signal?: AbortSignal): Promise<CreditWallet> {
  const response = await http.get('/api/v1/credits/wallet', { signal, timeout: 20000 })
  const wallet = response.data?.data
  if (!isApiResponse(response.data) || !wallet ||
    !Number.isSafeInteger(wallet.credit_balance) || wallet.credit_balance < 0 ||
    typeof wallet.can_generate !== 'boolean' ||
    !(wallet.active_job_id === null || (Number.isSafeInteger(wallet.active_job_id) && wallet.active_job_id > 0))) {
    throw new Error('생성권 지갑 응답 계약이 올바르지 않습니다.')
  }
  return wallet
}
