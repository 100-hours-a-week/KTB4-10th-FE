import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PolicyType } from '../../policy/api/policy.ts'
import { PolicyModal } from '../../policy/ui/PolicyModal.tsx'
import { startKakaoLogin } from '../api/auth.ts'
import { getOauthErrorMessage } from '../model/oauthError.ts'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const [policyType, setPolicyType] = useState<PolicyType | null>(null)
  const errorMessage = getOauthErrorMessage(searchParams.get('code'))

  return (
    <main className="app-shell login-page">
      <section className="login-hero" aria-labelledby="login-copy">
        <div>
          <h2 id="login-copy">여행을 더 쉽게,<br />가이드북을 더 특별하게</h2>
          <p>취향에 맞는 행사와 여행 일정을 한곳에서</p>
        </div>
        <div className="brand-mark" aria-label="KGB 임시 로고">KGB</div>
      </section>
      <section className="login-actions">
        {errorMessage && <p className="login-message" role="status" aria-label={errorMessage}>{errorMessage}</p>}
        <button className="primary-button" type="button" onClick={startKakaoLogin}>카카오로 로그인</button>
        <p className="policy-consent">
          로그인하면 <button type="button" onClick={() => setPolicyType('terms')}>이용약관</button>과{' '}
          <button type="button" onClick={() => setPolicyType('privacy')}>개인정보 처리방침</button>에 동의합니다.
        </p>
      </section>
      {policyType && <PolicyModal policyType={policyType} onClose={() => setPolicyType(null)} />}
    </main>
  )
}
