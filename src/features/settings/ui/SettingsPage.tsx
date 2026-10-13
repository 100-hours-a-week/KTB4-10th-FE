import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import {
  getMemberSettings,
  updatePushEnabled,
} from '../../member/api/memberSettings.ts'
import { notifyRealtimeNotificationSettingChanged } from '../../notification/model/events.ts'
import { enableWebPush, webPushErrorMessage } from '../../notification/model/webPush.ts'
import { logout, withdrawMember } from '../api/settings.ts'
import './settings-page.css'

type SettingsModal =
  | 'notification-help'
  | 'logout'
  | 'withdrawal-notice'
  | 'withdrawal-confirm'
  | null

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
      if (enabled) await enableWebPush()
      const settings = await updatePushEnabled(enabled)
      setPushEnabled(settings.push_enabled)
      notifyRealtimeNotificationSettingChanged(settings.push_enabled)
    } catch (error) {
      setToast(webPushErrorMessage(error))
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
            <div className="settings-notification-label">
              <strong>알림 받기</strong>
              <button
                className="settings-notification-help-button"
                type="button"
                aria-label="알림 설정 방법 보기"
                onClick={() => setModal('notification-help')}
              >
                <img src="/assets/settings/info.png" alt="" aria-hidden="true" />
              </button>
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

      {modal === 'notification-help' && (
        <div className="settings-modal-backdrop" role="presentation">
          <section
            className="settings-modal settings-modal--notification-help"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-help-title"
          >
            <h2 id="notification-help-title">알림 설정 방법</h2>
            <div className="settings-notification-guide">
              <p>
                브라우저의 사이트 알림 권한과 기기의 알림 권한을 모두 허용해야
                알림을 받을 수 있어요.
              </p>
              <section aria-labelledby="ios-notification-guide-title">
                <h3 id="ios-notification-guide-title">iOS</h3>
                <ol>
                  <li>KGB를 홈 화면에 추가해 웹 앱으로 실행해 주세요.</li>
                  <li><strong>설정 → 알림 → KGB → 알림 허용</strong>을 켜 주세요.</li>
                </ol>
              </section>
              <section aria-labelledby="android-notification-guide-title">
                <h3 id="android-notification-guide-title">Android</h3>
                <ol>
                  <li><strong>설정 → 알림 → 앱 알림</strong>으로 이동해 주세요.</li>
                  <li>사용하는 브라우저 또는 설치된 KGB 웹 앱의 알림을 허용해 주세요.</li>
                </ol>
              </section>
            </div>
            <div className="settings-modal__actions settings-modal__actions--confirm">
              <button type="button" autoFocus onClick={closeModal}>확인</button>
            </div>
          </section>
        </div>
      )}

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
