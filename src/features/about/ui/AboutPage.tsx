import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import './about-page.css'

const screens = [
  {
    image: '/assets/about/01-event-explore.jpg',
    step: '01',
    label: '행사 탐색',
    title: '지역과 시기에 맞는 행사를 찾아보세요',
    description: '전국 관광 행사 정보를 지역과 월로 좁혀 여행의 시작점을 발견할 수 있어요.',
    alt: '지역과 월로 필터링할 수 있는 KGB 행사 정보 화면',
  },
  {
    image: '/assets/about/02-guidebook-list.jpg',
    step: '02',
    label: '가이드북 관리',
    title: '만든 여행을 한곳에서 관리해요',
    description: '생성한 가이드북을 다시 열어보고, 필요할 때 PDF로 간직할 수 있어요.',
    alt: '생성한 여행 가이드북 목록과 PDF 저장 기능 화면',
  },
  {
    image: '/assets/about/03-guidebook-viewer.jpg',
    step: '03',
    label: '여행 가이드북',
    title: '여행의 맥락까지 담은 한 권을 완성해요',
    description: '장소 나열을 넘어 일정과 이야기, 여행 팁을 읽기 좋은 가이드북으로 구성해요.',
    alt: '종로 예술 산책 데이트 가이드북 표지 화면',
  },
  {
    image: '/assets/about/04-my-page.jpg',
    step: '04',
    label: '개인화 관리',
    title: '취향과 알림을 편하게 관리해요',
    description: '쿠폰, 여행 취향, 알림 설정을 하나의 마이페이지에서 확인할 수 있어요.',
    alt: '회원 정보와 쿠폰, 취향, 설정 메뉴가 있는 KGB 마이페이지',
  },
  {
    image: '/assets/about/05-preferences.jpg',
    step: '05',
    label: '취향 선택',
    title: '좋아하는 여행부터 알려주세요',
    description: '테마와 세부 취향, 여행 스타일을 선택하면 가이드북 추천에 반영해요.',
    alt: '여행 테마와 세부 취향을 선택하는 KGB 취향 설정 화면',
  },
  {
    image: '/assets/about/06-map.jpg',
    step: '06',
    label: '지도 탐색',
    title: '여행 후보를 지도 위에서 살펴봐요',
    description: '현재 위치 주변의 장소와 행사를 지도에서 확인하고 여행 후보를 탐색할 수 있어요.',
    alt: '관광 장소 핀이 표시된 KGB 지도 탐색 화면',
  },
] as const

const features = [
  {
    number: '01',
    title: '취향 기반 탐색',
    description: '자연, 역사, 체험, 행사 등 좋아하는 여행 테마를 기준으로 여행 후보를 좁혀요.',
  },
  {
    number: '02',
    title: '관광 데이터 연결',
    description: '한국관광공사 TourAPI의 장소와 행사 정보를 지도와 검색 경험으로 연결해요.',
  },
  {
    number: '03',
    title: 'AI 가이드북 생성',
    description: '선택한 조건을 일정과 이야기로 엮어 읽고 저장할 수 있는 여행 가이드북을 만들어요.',
  },
] as const

export function AboutPage() {
  useEffect(() => {
    const previousTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = description?.content
    document.title = 'KGB | 취향 기반 AI 여행 가이드북'
    if (description) {
      description.content = '취향과 한국 관광 데이터를 바탕으로 나만의 여행 가이드북을 만드는 KGB를 소개합니다.'
    }
    return () => {
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
    }
  }, [])

  return (
    <main className="about-page">
      <header className="about-header">
        <a className="about-brand" href="#top" aria-label="KGB 소개 페이지 맨 위로 이동">
          <span aria-hidden="true">K</span>
          <strong>KGB</strong>
        </a>
        <nav aria-label="소개 페이지 메뉴">
          <a href="#features">서비스</a>
          <a href="#screens">화면</a>
          <a href="#project">프로젝트</a>
        </nav>
        <Link className="about-header__cta" to={routes.home}>시작하기</Link>
      </header>

      <section className="about-hero" id="top">
        <div className="about-hero__copy">
          <p className="about-eyebrow">KOREA GUIDE BOOK</p>
          <h1>취향에서 시작해,<br />한 권의 여행으로.</h1>
          <p className="about-hero__description">
            KGB는 여행 취향과 한국 관광 데이터를 연결해<br className="about-desktop-break" />
            나만의 여행 가이드북을 만드는 웹 서비스입니다.
          </p>
          <div className="about-hero__actions">
            <Link className="about-button about-button--primary" to={routes.home}>KGB 시작하기</Link>
            <a className="about-button about-button--secondary" href="#screens">서비스 둘러보기</a>
          </div>
          <ul className="about-hero__facts" aria-label="KGB 주요 특징">
            <li>취향 기반</li>
            <li>한국 관광 데이터</li>
            <li>AI 가이드북</li>
          </ul>
        </div>

        <div className="about-hero__visual" aria-label="KGB 서비스 화면 미리보기">
          <div className="about-phone about-phone--back" aria-hidden="true">
            <img src="/assets/about/06-map.jpg" alt="" width="684" height="1498" />
          </div>
          <div className="about-phone about-phone--front">
            <img
              src="/assets/about/03-guidebook-viewer.jpg"
              alt="KGB가 생성한 종로 여행 가이드북 화면"
              width="684"
              height="1498"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <section className="about-intro" id="features" aria-labelledby="about-features-title">
        <div className="about-section-heading">
          <p className="about-eyebrow">WHY KGB</p>
          <h2 id="about-features-title">찾는 시간은 줄이고,<br />여행의 기대는 더 크게.</h2>
          <p>흩어진 관광 정보를 찾고 일정을 정리하는 과정을 하나의 흐름으로 연결합니다.</p>
        </div>
        <div className="about-feature-grid">
          {features.map((feature) => (
            <article className="about-feature-card" key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-screens" id="screens" aria-labelledby="about-screens-title">
        <div className="about-section-heading about-section-heading--center">
          <p className="about-eyebrow">PRODUCT TOUR</p>
          <h2 id="about-screens-title">여행을 발견하고,<br />나만의 기록으로 남기는 과정</h2>
          <p>현재 KGB에서 실제로 제공하는 화면을 확인해 보세요.</p>
        </div>
        <div className="about-screen-grid">
          {screens.map((screen) => (
            <article className="about-screen-card" key={screen.step}>
              <div className="about-screen-card__image">
                <img
                  src={screen.image}
                  alt={screen.alt}
                  width="684"
                  height="1498"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="about-screen-card__copy">
                <p><span>{screen.step}</span>{screen.label}</p>
                <h3>{screen.title}</h3>
                <div>{screen.description}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-project" id="project" aria-labelledby="about-project-title">
        <div>
          <p className="about-eyebrow">ABOUT THE PROJECT</p>
          <h2 id="about-project-title">한국의 여행지를<br />더 쉽게 발견하도록.</h2>
        </div>
        <div className="about-project__details">
          <p>
            KGB는 공공 관광 데이터와 개인의 여행 취향을 연결해 탐색부터 가이드북 생성까지
            이어지는 모바일 중심 웹 애플리케이션입니다.
          </p>
          <dl>
            <div>
              <dt>관광 데이터</dt>
              <dd>
                <a href="https://www.data.go.kr/" target="_blank" rel="noreferrer">공공데이터포털</a>을 통한{' '}
                <a href="https://api.visitkorea.or.kr/" target="_blank" rel="noreferrer">한국관광공사 TourAPI</a> 활용
              </dd>
            </div>
            <div>
              <dt>서비스 형태</dt>
              <dd>모바일 중심 웹 애플리케이션</dd>
            </div>
            <div>
              <dt>문의</dt>
              <dd><a href="mailto:ktb10@kguidebook.site">ktb10@kguidebook.site</a></dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="about-closing" aria-labelledby="about-closing-title">
        <p className="about-eyebrow">START YOUR JOURNEY</p>
        <h2 id="about-closing-title">다음 여행의 첫 페이지를<br />KGB와 함께 열어보세요.</h2>
        <Link className="about-button about-button--light" to={routes.home}>KGB 시작하기</Link>
      </section>

      <footer className="about-footer">
        <div className="about-brand about-brand--footer"><span aria-hidden="true">K</span><strong>KGB</strong></div>
        <p>취향 기반 AI 여행 가이드북</p>
        <a href="mailto:ktb10@kguidebook.site">ktb10@kguidebook.site</a>
      </footer>
    </main>
  )
}
