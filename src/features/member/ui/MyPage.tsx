import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentMember, type CurrentMember } from '../../auth/api/auth.ts'
import { routes } from '../../../shared/config/routes.ts'
import { BottomNavigation } from '../../../shared/ui/BottomNavigation.tsx'
import { NotificationBellIcon, PageHeader } from '../../../shared/ui/PageHeader.tsx'

function ProfileFallback({ nickname }: { nickname: string }) {
  return (
    <span className="mypage-profile__fallback" aria-hidden="true">
      {nickname.trim().charAt(0) || 'K'}
    </span>
  )
}

export function MyPage() {
  const navigate = useNavigate()
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profileImageFailed, setProfileImageFailed] = useState(false)

  const loadMember = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setProfileImageFailed(false)
    try {
      setMember(await getCurrentMember())
    } catch {
      setLoadError('회원 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // 라우트 진입 시 세션 회원 정보를 동기화하기 위한 조회 Effect입니다.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadMember()
  }, [loadMember])

  const hasUnreadNotifications = (member?.unread_count ?? 0) > 0

  return (
    <main className="app-shell mypage-page">
      <PageHeader title="마이페이지">
        <button
          className="app-page-header__notification"
          type="button"
          aria-label={hasUnreadNotifications
            ? `읽지 않은 알림 ${member?.unread_count}개 확인`
            : '알림 확인'}
          onClick={() => navigate(routes.notifications)}
        >
          <NotificationBellIcon />
          {hasUnreadNotifications && <span>{member?.unread_count}</span>}
        </button>
      </PageHeader>

      <div className="mypage-content">
        {isLoading && (
          <div className="mypage-state" role="status">
            <img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" />
            회원 정보를 불러오고 있어요.
          </div>
        )}

        {!isLoading && loadError && (
          <div className="mypage-state" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadMember()}>다시 불러오기</button>
          </div>
        )}

        {!isLoading && member && (
          <>
            <section className="mypage-profile" aria-label="회원 정보">
              <div className="mypage-profile__image">
                {member.profile_image_url && !profileImageFailed ? (
                  <img
                    src={member.profile_image_url}
                    alt={`${member.nickname} 프로필`}
                    onError={() => setProfileImageFailed(true)}
                  />
                ) : (
                  <ProfileFallback nickname={member.nickname} />
                )}
              </div>
              <div className="mypage-profile__details">
                <strong>{member.nickname}</strong>
                <span>{member.email ?? '이메일 정보 없음'}</span>
              </div>
            </section>

            <nav className="mypage-menu" aria-label="마이페이지 메뉴">
              <button type="button" onClick={() => navigate(routes.preferences)}>
                <span>
                  <strong>취향 및 선호 수정</strong>
                  <small>저장한 여행 취향을 확인하고 바꿔요.</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" onClick={() => navigate(routes.settings)}>
                <span>
                  <strong>설정</strong>
                  <small>알림 설정, 로그아웃, 회원 탈퇴를 관리해요.</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </nav>
          </>
        )}
      </div>

      <BottomNavigation />
    </main>
  )
}
