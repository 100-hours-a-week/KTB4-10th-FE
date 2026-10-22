import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFavorites, removeFavorite } from '../../map/api/favorites.ts'
import { FavoritePage } from './FavoritePage.tsx'

vi.mock('../../map/api/favorites.ts', () => ({
  listFavorites: vi.fn(),
  removeFavorite: vi.fn(),
}))

const listFavoritesMock = vi.mocked(listFavorites)
const removeFavoriteMock = vi.mocked(removeFavorite)

const items = [
  {
    content_id: 'event-1', title: '서울 가을 축제', content_type: 'EVENT' as const,
    address: '서울 중구', thumbnail_url: 'https://example.com/event.jpg',
    event_period: { start_date: '2026-10-24', end_date: '2026-10-25' }, is_favorite: true,
  },
  {
    content_id: 'place-1', title: '서울숲', content_type: 'PLACE' as const,
    address: '서울 성동구', thumbnail_url: null, event_period: null, is_favorite: true,
  },
]

function CurrentRoute() {
  const location = useLocation()
  return <output aria-label="현재 경로">{location.pathname}:{JSON.stringify(location.state)}</output>
}

describe('FavoritePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listFavoritesMock.mockResolvedValue({ items, next_cursor: null, has_more: false })
    removeFavoriteMock.mockResolvedValue(undefined)
  })

  it('행사와 장소 카드를 표시하고 행사만 상세 페이지로 연결한다', async () => {
    render(<MemoryRouter initialEntries={['/mypage/favorites']}>
      <Routes>
        <Route path="/mypage/favorites" element={<FavoritePage />} />
        <Route path="/events/:contentId" element={<CurrentRoute />} />
      </Routes>
    </MemoryRouter>)

    expect(await screen.findByText('서울 가을 축제')).toBeInTheDocument()
    expect(screen.getByText('2026.10.24 – 2026.10.25')).toBeInTheDocument()
    expect(screen.getByText('서울숲')).toBeInTheDocument()
    expect(screen.getByText('서울 성동구')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /서울 가을 축제/ })).toHaveAttribute('href', '/events/event-1')
    expect(screen.queryByRole('link', { name: /서울숲/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: /서울 가을 축제/ }))
    expect(screen.getByRole('status', { name: '현재 경로' }))
      .toHaveTextContent('/events/event-1:{"returnTo":"/mypage/favorites","initialFavorite":true}')
  })

  it('선택 이미지를 표시하고 해제에 성공하면 카드를 제거한다', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><FavoritePage /></MemoryRouter>)

    const removeButton = await screen.findByRole('button', { name: '서울숲 즐겨찾기 해제' })
    expect(removeButton.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/favorite/favorite-selected.png',
    )
    await user.click(removeButton)

    await waitFor(() => expect(removeFavoriteMock).toHaveBeenCalledWith('place-1'))
    expect(screen.queryByText('서울숲')).not.toBeInTheDocument()
  })

  it('목록이 비어 있으면 저장 방법을 안내한다', async () => {
    listFavoritesMock.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
    render(<MemoryRouter><FavoritePage /></MemoryRouter>)

    expect(await screen.findByText('아직 저장한 장소나 행사가 없어요')).toBeInTheDocument()
    expect(screen.getByText('지도와 행사 정보에서 관심 있는 곳을 저장해 보세요.')).toBeInTheDocument()
  })
})
