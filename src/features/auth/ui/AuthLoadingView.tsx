export function AuthLoadingView() {
  return (
    <main className="app-shell auth-result-page" aria-busy="true">
      <div className="auth-result-page__content">
        <div className="brand-mark" aria-label="KGB 임시 로고">
          KGB
        </div>
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
