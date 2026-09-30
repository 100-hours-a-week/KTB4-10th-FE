export function AuthLoadingView() {
  return (
    <main className="app-shell auth-result-page" aria-busy="true">
      <div className="brand-mark auth-brand-position" aria-label="KGB 임시 로고">
        KGB
      </div>
      <div className="auth-result-page__status">
        <img
          className="loading-indicator"
          src="/assets/loading-indicator.svg"
          alt=""
        />
        <h1>로그인 정보를 확인하고 있어요</h1>
        <p>
          회원 정보를 확인한 뒤
          <br />
          알맞은 화면으로 이동할게요.
        </p>
      </div>
    </main>
  )
}

export function SessionCheckLoadingView() {
  return (
    <main
      className="app-shell auth-result-page"
      aria-busy="true"
      aria-label="화면을 준비하고 있어요."
    >
      <div className="brand-mark auth-brand-position" aria-label="KGB 임시 로고">
        KGB
      </div>
      <div className="auth-result-page__status">
        <img
          className="loading-indicator"
          src="/assets/loading-indicator.svg"
          alt=""
        />
      </div>
    </main>
  )
}

export function AuthCheckErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="app-shell auth-result-page">
      <div className="brand-mark auth-brand-position" aria-label="KGB 임시 로고">
        KGB
      </div>
      <div className="auth-result-page__status" role="alert">
        <h1>로그인 상태를 확인하지 못했어요</h1>
        <p>
          네트워크 연결이나 서버 상태를 확인한 뒤
          <br />
          다시 시도해 주세요.
        </p>
        <button className="primary-button" type="button" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    </main>
  )
}
