import { useEffect, useState } from 'react'
import { getPolicy, type Policy, type PolicyType } from '../api/policy.ts'

type PolicyModalProps = { policyType: PolicyType; onClose: () => void }

function toReadablePolicy(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\|\s*[-:]+(?:\s*\|\s*[-:]+)+\s*\|?$/gm, '')
    .replace(/^\|/gm, '')
    .replace(/\|$/gm, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function PolicyModal({ policyType, onClose }: PolicyModalProps) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [hasError, setHasError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    getPolicy(policyType)
      .then((response) => { if (active) setPolicy(response) })
      .catch(() => { if (active) setHasError(true) })
    return () => { active = false }
  }, [policyType, retryCount])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="policy-modal" role="dialog" aria-modal="true" aria-labelledby="policy-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="policy-modal-title">{policy?.title ?? (policyType === 'terms' ? '이용약관' : '개인정보 처리방침')}</h2>
        <div className="policy-modal__content" tabIndex={0}>
          {hasError && (
            <div className="policy-modal__error">
              <p>내용을 불러오지 못했어요. 백엔드 실행 상태를 확인한 뒤 다시 시도해 주세요.</p>
              <button
                type="button"
                onClick={() => {
                  setHasError(false)
                  setRetryCount((count) => count + 1)
                }}
              >
                다시 불러오기
              </button>
            </div>
          )}
          {!hasError && !policy && '내용을 불러오고 있어요.'}
          {policy && toReadablePolicy(policy.content)}
        </div>
        <button className="primary-button" type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  )
}
