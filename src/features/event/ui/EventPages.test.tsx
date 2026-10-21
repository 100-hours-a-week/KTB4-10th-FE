import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventDetailPage } from './EventDetailPage.tsx'
import { EventListPage } from './EventListPage.tsx'

const { getCurrentMemberMock, getEventDetailMock, getEventsMock, getNewEventsMock, removeFavoriteMock, saveFavoriteMock } = vi.hoisted(() => ({
  getCurrentMemberMock: vi.fn(),
  getEventDetailMock: vi.fn(),
  getEventsMock: vi.fn(),
  getNewEventsMock: vi.fn(),
  removeFavoriteMock: vi.fn(),
  saveFavoriteMock: vi.fn(),
}))

vi.mock('../../auth/api/auth.ts', () => ({
  getCurrentMember: getCurrentMemberMock,
}))

vi.mock('../api/events.ts', async () => {
  const actual = await vi.importActual('../api/events.ts')
  return {
    ...actual,
    getEventDetail: getEventDetailMock,
    getEvents: getEventsMock,
    getNewEvents: getNewEventsMock,
  }
})

vi.mock('../../map/api/favorites.ts', () => ({
  removeFavorite: removeFavoriteMock,
  saveFavorite: saveFavoriteMock,
}))

const preview = {
  content_id: 'event-1',
  title: '수원 국가유산 야행',
  address: '경기도 수원시 수원화성',
  thumbnail_url: 'https://example.com/event.jpg',
  start_date: '2026-08-14',
  end_date: '2026-08-30',
  source_created_at: '2026-10-15T08:30:00',
}

function SearchProbe() {
  const { search } = useLocation()
  return <output aria-label="현재 query">{search}</output>
}

function HistoryBackButton() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>테스트 뒤로가기</button>
}

function NotificationDestination() {
  const location = useLocation()
  return <output aria-label="알림 이동 정보">{JSON.stringify(location.state)}</output>
}

describe('event information pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentMemberMock.mockResolvedValue({ unread_count: 0 })
    removeFavoriteMock.mockResolvedValue(undefined)
    saveFavoriteMock.mockResolvedValue({ content_id: 'event-1' })
  })

  it('전체 행사와 오늘 등록된 행사 표시를 함께 제공한다', async () => {
    getEventsMock.mockResolvedValue({
      items: [{
        content_id: 'event-1', title: preview.title, category: 'EVENT',
        region: { administrative_code: '41', name: '경기도' },
        address: preview.address, thumbnail_url: preview.thumbnail_url,
        event_period: { start_date: preview.start_date, end_date: preview.end_date },
      }],
      page: 1, size: 20, total_items: 1, total_pages: 1,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15',
      items: [preview],
      page: 1,
      size: 20,
      total_items: 1,
      total_pages: 1,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)

    expect(await screen.findByText('수원 국가유산 야행')).toBeInTheDocument()
    expect(screen.getByText('행사 둘러보기')).toBeInTheDocument()
    expect(screen.getByText('오늘 새로 등록된 행사 1개')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /수원 국가유산 야행/ }))
      .toHaveAttribute('href', '/events/event-1')
    expect(screen.getByRole('link', { name: '정보' })).toHaveClass(
      'bottom-navigation__item--active',
    )
  })

  it('신규 행사가 없어도 전체 행사 목록은 표시한다', async () => {
    getEventsMock.mockResolvedValue({
      items: [{
        content_id: 'event-2', title: '계속 진행 중인 행사', category: 'EVENT',
        region: null, address: '서울특별시', thumbnail_url: null, event_period: null,
      }],
      page: 1, size: 20, total_items: 1, total_pages: 1,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)

    expect(await screen.findByText('계속 진행 중인 행사')).toBeInTheDocument()
    expect(screen.queryByText(/오늘 새로 등록된 행사/)).not.toBeInTheDocument()
  })

  it('NEW 안내를 누르면 오늘 등록된 행사만 보고 전체 목록으로 돌아간다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [{
        content_id: 'event-old', title: '기존 행사', category: 'EVENT', region: null,
        address: '서울특별시', thumbnail_url: null, event_period: null,
      }],
      page: 1, size: 20, total_items: 1, total_pages: 1,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-21', items: [preview], page: 1, size: 20, total_items: 1, total_pages: 1,
    })

    render(
      <MemoryRouter initialEntries={['/information']}>
        <EventListPage />
        <SearchProbe />
      </MemoryRouter>,
    )

    expect(await screen.findByText('기존 행사')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /오늘 새로 등록된 행사 1개/ }))

    expect(await screen.findByRole('heading', { name: '오늘 새로 등록된 행사' })).toBeInTheDocument()
    expect(screen.getByText(preview.title)).toBeInTheDocument()
    expect(screen.queryByText('기존 행사')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '행사명 검색' })).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: '현재 query' })).toHaveTextContent('?view=new')

    await user.click(screen.getByRole('button', { name: /전체 행사로 돌아가기/ }))
    expect(await screen.findByText('기존 행사')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '행사명 검색' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '현재 query' })).toHaveTextContent('')
  })

  it('행사 헤더에 읽지 않은 알림 상태를 반영한다', async () => {
    getCurrentMemberMock.mockResolvedValue({ unread_count: 2 })
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: '읽지 않은 알림 2개 확인' }))
      .toBeInTheDocument()
    window.dispatchEvent(new CustomEvent('kgb:notifications-updated', {
      detail: { unreadCount: 3 },
    }))
    expect(await screen.findByRole('button', { name: '읽지 않은 알림 3개 확인' }))
      .toBeInTheDocument()
  })

  it('정보 페이지의 알림 버튼은 현재 필터 query를 반환 경로로 전달한다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(
      <MemoryRouter initialEntries={['/information?region_code=11&month=2026-10']}>
        <Routes>
          <Route path="/information" element={<EventListPage />} />
          <Route path="/mypage/notifications" element={<NotificationDestination />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '알림 확인' }))
    expect(screen.getByRole('status', { name: '알림 이동 정보' }))
      .toHaveTextContent('{"returnTo":"/information?region_code=11&month=2026-10"}')
  })

  it('페이지 버튼을 누르면 해당 페이지를 조회한다', async () => {
    const user = userEvent.setup()
    getEventsMock
      .mockResolvedValueOnce({
        items: [{
          content_id: 'event-1', title: '1페이지 행사', category: 'EVENT',
          region: null, address: null, thumbnail_url: null, event_period: null,
        }],
        page: 1, size: 20, total_items: 45, total_pages: 3,
      })
      .mockResolvedValueOnce({
        items: [{
          content_id: 'event-2', title: '2페이지 행사', category: 'EVENT',
          region: null, address: null, thumbnail_url: null, event_period: null,
        }],
        page: 2, size: 20, total_items: 45, total_pages: 3,
      })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: '2' }))
    expect(await screen.findByText('2페이지 행사')).toBeInTheDocument()
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '', regionCode: '', month: '', page: 2,
    }, expect.any(AbortSignal))
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
  })

  it('같은 검색어나 공백 검색을 다시 제출해도 재조회한다', async () => {
    const user = userEvent.setup()
    const emptyPage = {
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    }
    getEventsMock.mockResolvedValue(emptyPage)
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)
    await screen.findByText('검색 결과가 없어요')

    const searchInput = screen.getByRole('textbox', { name: '행사명 검색' })
    await user.type(searchInput, '   {Enter}')
    await screen.findByText('검색 결과가 없어요')

    expect(getEventsMock).toHaveBeenCalledTimes(2)
  })

  it('지역과 월을 선택하면 검색어와 함께 첫 페이지를 즉시 조회한다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(
      <MemoryRouter initialEntries={['/information?q=야행&page=3']}>
        <EventListPage />
        <SearchProbe />
      </MemoryRouter>,
    )
    await screen.findByText('검색 결과가 없어요')

    await user.click(screen.getByRole('button', { name: '지역 필터: 전체' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '서울' }))
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '야행', regionCode: '11', month: '', page: 1,
    }, expect.any(AbortSignal))

    await user.click(screen.getByRole('button', { name: '월 필터: 전체' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 개최 월' }))
      .getByRole('option', { name: '10월' }))
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '야행', regionCode: '11', month: '2026-10', page: 1,
    }, expect.any(AbortSignal))
    expect(screen.getByRole('status', { name: '현재 query' }))
      .toHaveTextContent('?q=%EC%95%BC%ED%96%89&region_code=11&month=2026-10')
  })

  it('URL의 필터를 복구하고 비정상 query는 기본 상태로 정규화한다', async () => {
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(
      <MemoryRouter initialEntries={['/information?q=봄&q=가을&region_code=999&month=2025-13&page=0&size=100']}>
        <EventListPage />
        <SearchProbe />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status', { name: '현재 query' })).toHaveTextContent('')
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '', regionCode: '', month: '', page: 1,
    }, expect.any(AbortSignal))
    expect(screen.getByRole('button', { name: '지역 필터: 전체' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: '월 필터: 전체' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('전체를 선택하면 해당 필터 query를 제거한다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(
      <MemoryRouter initialEntries={['/information?region_code=11&month=2026-10']}>
        <EventListPage />
        <SearchProbe />
      </MemoryRouter>,
    )
    await screen.findByText('검색 결과가 없어요')

    await user.click(screen.getByRole('button', { name: '지역 필터: 서울' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '전체' }))
    expect(screen.getByRole('button', { name: '지역 필터: 전체' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: '월 필터: 10월' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 개최 월' }))
      .getByRole('option', { name: '전체' }))

    expect(screen.getByRole('button', { name: '지역 필터: 전체' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '월 필터: 전체' })).toBeInTheDocument()

    expect(screen.getByRole('status', { name: '현재 query' })).toHaveTextContent('')
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '', regionCode: '', month: '', page: 1,
    }, expect.any(AbortSignal))
  })

  it('월 필터에서 앞자리 0을 제외한 월 이름을 표시한다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(
      <MemoryRouter initialEntries={['/information']}>
        <EventListPage />
      </MemoryRouter>,
    )
    await screen.findByText('검색 결과가 없어요')

    await user.click(screen.getByRole('button', { name: '월 필터: 전체' }))
    expect(within(screen.getByRole('listbox', { name: '행사 개최 월' }))
      .getByRole('option', { name: '1월' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '01월' })).not.toBeInTheDocument()
  })

  it('뒤로가기로 이전 필터 상태를 복원한다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(
      <MemoryRouter initialEntries={['/information']}>
        <EventListPage />
        <HistoryBackButton />
      </MemoryRouter>,
    )
    await screen.findByText('검색 결과가 없어요')
    await user.click(screen.getByRole('button', { name: '지역 필터: 전체' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '서울' }))
    await user.click(screen.getByRole('button', { name: '지역 필터: 서울' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '부산' }))
    await user.click(screen.getByRole('button', { name: '테스트 뒤로가기' }))

    expect(await screen.findByRole('button', { name: '지역 필터: 서울' })).toBeInTheDocument()
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '', regionCode: '11', month: '', page: 1,
    }, expect.any(AbortSignal))
  })

  it('빠른 필터 변경은 앞선 목록 요청을 취소한다', async () => {
    const user = userEvent.setup()
    const signals: AbortSignal[] = []
    getEventsMock.mockImplementation((_request, signal: AbortSignal) => {
      signals.push(signal)
      return Promise.resolve({
        items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
      })
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)
    await screen.findByText('검색 결과가 없어요')
    await user.click(screen.getByRole('button', { name: '지역 필터: 전체' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '서울' }))
    const seoulSignal = signals.at(-1)
    await user.click(screen.getByRole('button', { name: '지역 필터: 서울' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '부산' }))

    expect(seoulSignal?.aborted).toBe(true)
    expect(getEventsMock).toHaveBeenLastCalledWith({
      query: '', regionCode: '26', month: '', page: 1,
    }, expect.any(AbortSignal))
  })

  it('지역과 월 드롭다운은 하나만 열리고 바깥 선택 시 값을 바꾸지 않고 닫힌다', async () => {
    const user = userEvent.setup()
    getEventsMock.mockResolvedValue({
      items: [], page: 1, size: 10, total_items: 0, total_pages: 0,
    })
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)
    await screen.findByText('검색 결과가 없어요')

    await user.click(screen.getByRole('button', { name: '지역 필터: 전체' }))
    expect(screen.getByRole('listbox', { name: '행사 지역' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '월 필터: 전체' }))
    expect(screen.queryByRole('listbox', { name: '행사 지역' })).not.toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: '행사 개최 월' })).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '월 필터: 전체' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지역 필터: 전체' }))
    await user.click(within(screen.getByRole('listbox', { name: '행사 지역' }))
      .getByRole('option', { name: '서울' }))
    await user.click(screen.getByRole('button', { name: '지역 필터: 서울' }))
    await user.click(document.body)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '지역 필터: 서울' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('개발 환경에서도 목록 API 오류를 fixture로 숨기지 않는다', async () => {
    getEventsMock.mockRejectedValue(new Error('network'))
    getNewEventsMock.mockResolvedValue({
      date: '2026-10-15', items: [], page: 1, size: 20, total_items: 0, total_pages: 0,
    })

    render(<MemoryRouter initialEntries={['/information']}><EventListPage /></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('행사 정보를 불러오지 못했어요')
    expect(screen.queryByText('수원 국가유산 야행')).not.toBeInTheDocument()
  })

  it('행사 상세 정보와 이용 정보를 표시한다', async () => {
    getEventDetailMock.mockResolvedValue({
      content_id: 'event-1',
      title: '수원 국가유산 야행',
      category: 'EVENT',
      region: { administrative_code: '41', name: '경기도' },
      latitude: 37.2,
      longitude: 127.0,
      thumbnail_url: preview.thumbnail_url,
      description: '수원화성 일원에서 열리는 야간 문화유산 축제입니다.',
      address: preview.address,
      phone: '031-000-0000',
      homepage_url: 'https://example.com',
      images: [],
      event_detail: {
        start_date: preview.start_date,
        end_date: preview.end_date,
        operating_hours: '18:00~23:00',
        organizer: '수원시',
        organizer_phone: null,
        event_place: '수원화성 일원',
      },
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/events/event-1', state: { preview } }]}>
        <Routes><Route path="/events/:contentId" element={<EventDetailPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('행사 소개')).toBeInTheDocument()
    expect(screen.getByText('수원화성 일원에서 열리는 야간 문화유산 축제입니다.'))
      .toBeInTheDocument()
    expect(screen.getByText('18:00~23:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /공식 홈페이지/ }))
      .toHaveAttribute('href', 'https://example.com')
    expect(screen.queryByRole('link', { name: '다른 행사 둘러보기' })).not.toBeInTheDocument()
  })

  it('상세 페이지에서 별 버튼으로 즐겨찾기를 등록하고 해제한다', async () => {
    const user = userEvent.setup()
    getEventDetailMock.mockResolvedValue({
      content_id: 'event-1', title: '관심 행사', category: 'EVENT', region: null,
      latitude: 37.2, longitude: 127.0, thumbnail_url: null, description: null,
      address: '서울특별시', phone: null, homepage_url: null, images: [], event_detail: null,
    })

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes><Route path="/events/:contentId" element={<EventDetailPage />} /></Routes>
      </MemoryRouter>,
    )

    const favoriteButton = await screen.findByRole('button', { name: '관심 행사 즐겨찾기 저장' })
    expect(favoriteButton).toHaveTextContent('☆')
    await user.click(favoriteButton)
    expect(saveFavoriteMock).toHaveBeenCalledWith('event-1')

    const removeButton = await screen.findByRole('button', { name: '관심 행사 즐겨찾기 해제' })
    expect(removeButton).toHaveTextContent('★')
    await user.click(removeButton)
    expect(removeFavoriteMock).toHaveBeenCalledWith('event-1')
    expect(await screen.findByRole('button', { name: '관심 행사 즐겨찾기 저장' }))
      .toHaveTextContent('☆')
  })

  it('관심 장소 등록 실패를 안내한다', async () => {
    const user = userEvent.setup()
    saveFavoriteMock.mockRejectedValue(new Error('network'))
    getEventDetailMock.mockResolvedValue({
      content_id: 'event-1', title: '관심 행사', category: 'EVENT', region: null,
      latitude: null, longitude: null, thumbnail_url: null, description: null,
      address: null, phone: null, homepage_url: null, images: [], event_detail: null,
    })

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes><Route path="/events/:contentId" element={<EventDetailPage />} /></Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '관심 행사 즐겨찾기 저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('즐겨찾기 상태를 변경하지 못했어요.')
  })

  it('상세 조회 실패 후 다시 요청한다', async () => {
    const user = userEvent.setup()
    getEventDetailMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        content_id: 'event-1', title: '재시도 행사', category: 'EVENT', region: null,
        latitude: null, longitude: null, thumbnail_url: null, description: null,
        address: null, phone: null, homepage_url: null, images: [], event_detail: null,
      })

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes><Route path="/events/:contentId" element={<EventDetailPage />} /></Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }))
    expect(await screen.findByRole('heading', { name: '재시도 행사' })).toBeInTheDocument()
    expect(getEventDetailMock).toHaveBeenCalledTimes(2)
  })
})
