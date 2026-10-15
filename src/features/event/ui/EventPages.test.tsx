import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventDetailPage } from './EventDetailPage.tsx'
import { EventListPage } from './EventListPage.tsx'

const { getEventDetailMock, getEventsMock, getNewEventsMock } = vi.hoisted(() => ({
  getEventDetailMock: vi.fn(),
  getEventsMock: vi.fn(),
  getNewEventsMock: vi.fn(),
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

const preview = {
  content_id: 'event-1',
  title: '수원 국가유산 야행',
  address: '경기도 수원시 수원화성',
  thumbnail_url: 'https://example.com/event.jpg',
  start_date: '2026-08-14',
  end_date: '2026-08-30',
  source_created_at: '2026-10-15T08:30:00',
}

describe('event information pages', () => {
  beforeEach(() => vi.clearAllMocks())

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
    expect(getEventsMock).toHaveBeenLastCalledWith('', 2, expect.any(AbortSignal))
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
