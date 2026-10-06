import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import {
  getMemberSettings,
  updatePushEnabled,
} from '../../member/api/memberSettings.ts'
import { notifyRealtimeNotificationSettingChanged } from '../../notification/model/events.ts'
import { logout, withdrawMember } from '../api/settings.ts'
import './settings-page.css'

type SettingsModal = 'logout' | 'withdrawal-notice' | 'withdrawal-confirm' | null

const WITHDRAWAL_CONFIRM_TEXT = '회원 탈퇴'

export function SettingsPage() {
  const navigate = useNavigate()
  const [modal, setModal] = useState<SettingsModal>(null)
  const [hasAcknowledgedWithdrawal, setHasAcknowledgedWithdrawal] = useState(false)
  const [withdrawalInput, setWithdrawalInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [isNotificationSettingLoading, setIsNotificationSettingLoading] = useState(true)
  const [isNotificationSettingSaving, setIsNotificationSettingSaving] = useState(false)
  const [hasInteractedWithNotificationSetting, setHasInteractedWithNotificationSetting] =
    useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void getMemberSettings(controller.signal)
      .then((settings) => setPushEnabled(settings.push_enabled))
      .catch(() => {
        if (!controller.signal.aborted) {
          setToast('알림 설정을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsNotificationSettingLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  const handleNotificationSettingChange = async (enabled: boolean) => {
    if (isNotificationSettingLoading || isNotificationSettingSaving) return
    setIsNotificationSettingSaving(true)
    try {
      const settings = await updatePushEnabled(enabled)
      setPushEnabled(settings.push_enabled)
      notifyRealtimeNotificationSettingChanged(settings.push_enabled)
    } catch {
      setToast('알림 설정을 변경하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setIsNotificationSettingSaving(false)
    }
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModal(null)
    setHasAcknowledgedWithdrawal(false)
    setWithdrawalInput('')
  }

  const handleLogout = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await logout()
      navigate(routes.home, { replace: true })
    } catch {
      setModal(null)
      setToast('로그아웃에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdrawal = async () => {
    if (withdrawalInput !== WITHDRAWAL_CONFIRM_TEXT || isSubmitting) return
    setIsSubmitting(true)
    try {
      await withdrawMember()
      navigate(routes.home, { replace: true })
    } catch {
      setModal(null)
      setHasAcknowledgedWithdrawal(false)
      setWithdrawalInput('')
      setToast('회원 탈퇴에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell settings-page">
      <header className="settings-page__header">
        <button type="button" aria-label="마이페이지로 돌아가기" onClick={() => navigate(routes.myPage)}>‹</button>
        <h1>설정</h1>
        <span aria-hidden="true" />
      </header>

      <div className="settings-page__content">
        <section className="settings-section" aria-labelledby="notification-settings-title">
          <h2 id="notification-settings-title">알림 설정</h2>
          <div className="settings-row">
            <div>
              <strong>알림 받기</strong>
            </div>
            <label
              className={`settings-toggle${hasInteractedWithNotificationSetting
                ? ' settings-toggle--interactive'
                : ''}`}
            >
              <input
                type="checkbox"
                checked={pushEnabled}
                disabled={isNotificationSettingLoading || isNotificationSettingSaving}
                aria-label="알림 받기"
                onChange={(event) => {
                  setHasInteractedWithNotificationSetting(true)
                  void handleNotificationSettingChange(event.target.checked)
                }}
              />
              <span aria-hidden="true" />
            </label>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="account-settings-title">
          <h2 id="account-settings-title">계정 설정</h2>
          <div className="settings-account-actions">
            <button type="button" onClick={() => setModal('logout')}>로그아웃</button>
            <button className="settings-account-actions__danger" type="button" onClick={() => setModal('withdrawal-notice')}>
              회원 탈퇴
            </button>
          </div>
        </section>
      </div>

      {modal === 'logout' && (
        <div className="settings-modal-backdrop" role="presentation">
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <h2 id="logout-title">로그아웃을 하시겠습니까?</h2>
            <div className="settings-modal__actions">
              <button type="button" disabled={isSubmitting} onClick={() => void handleLogout()}>
                {isSubmitting ? '로그아웃 중...' : '예'}
              </button>
              <button className="settings-modal__primary" type="button" disabled={isSubmitting} autoFocus onClick={closeModal}>아니요</button>
            </div>
          </section>
        </div>
      )}

      {modal === 'withdrawal-notice' && (
        <div className="settings-modal-backdrop" role="presentation">
          <section className="settings-modal settings-modal--withdrawal" role="dialog" aria-modal="true" aria-labelledby="withdrawal-notice-title">
            <h2 id="withdrawal-notice-title">회원 탈퇴 전 확인해주세요</h2>
            <ul>
              <li>로그인 세션이 종료되고 계정 정보를 더 이상 이용할 수 없어요.</li>
              <li>보유한 가이드북 생성권은 모두 소멸해요.</li>
              <li>진행 중인 가이드북 생성 작업은 취소될 수 있어요.</li>
            </ul>
            <label className="settings-withdrawal-check">
              <input
                type="checkbox"
                checked={hasAcknowledgedWithdrawal}
                onChange={(event) => setHasAcknowledgedWithdrawal(event.target.checked)}
              />
              <span>위 내용을 확인했습니다.</span>
            </label>
            <div className="settings-modal__actions">
              <button type="button" onClick={closeModal}>취소</button>
              <button
                type="button"
                disabled={!hasAcknowledgedWithdrawal}
                onClick={() => setModal('withdrawal-confirm')}
              >
                계속
              </button>
            </div>
          </section>
        </div>
      )}

      {modal === 'withdrawal-confirm' && (
        <div className="settings-modal-backdrop" role="presentation">
          <section className="settings-modal settings-modal--withdrawal" role="dialog" aria-modal="true" aria-labelledby="withdrawal-confirm-title">
            <h2 id="withdrawal-confirm-title">정말 탈퇴하시겠어요?</h2>
            <p>본인 확인을 위해 아래 입력란에 ‘회원 탈퇴’를 입력해 주세요.</p>
            <label className="settings-withdrawal-input">
              <span>회원 탈퇴 확인 문구</span>
              <input
                type="text"
                value={withdrawalInput}
                disabled={isSubmitting}
                autoFocus
                autoComplete="off"
                placeholder="회원 탈퇴"
                onChange={(event) => setWithdrawalInput(event.target.value)}
              />
            </label>
            <small>탈퇴가 완료되면 로그인 페이지로 이동합니다.</small>
            <div className="settings-modal__actions">
              <button type="button" disabled={isSubmitting} onClick={closeModal}>취소</button>
              <button
                className="settings-modal__danger"
                type="button"
                disabled={withdrawalInput !== WITHDRAWAL_CONFIRM_TEXT || isSubmitting}
                onClick={() => void handleWithdrawal()}
              >
                {isSubmitting ? '탈퇴 처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  )
}
