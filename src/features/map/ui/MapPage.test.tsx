import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MapPage } from './MapPage.tsx'

const {
  getMapContentsMock,
  removeFavoriteMock,
  saveFavoriteMock,
  updatePushEnabledMock,
} = vi.hoisted(() => ({
  getMapContentsMock: vi.fn(),
  removeFavoriteMock: vi.fn(),
  saveFavoriteMock: vi.fn(),
  updatePushEnabledMock: vi.fn(),
}))

vi.mock('../api/map.ts', () => ({
  clearMapContentCache: vi.fn(),
  getMapContents: getMapContentsMock,
  filterContentsWithinBounds: (items: unknown[]) => items,
}))

vi.mock('../api/settings.ts', () => ({
  updatePushEnabled: updatePushEnabledMock,
}))

vi.mock('../api/favorites.ts', () => ({
  removeFavorite: removeFavoriteMock,
  saveFavorite: saveFavoriteMock,
}))

vi.mock('./KakaoMapCanvas.tsx', () => ({
  KakaoMapCanvas: ({
    onBoundsChange,
    onMapClick,
  }: {
    onBoundsChange: (bounds: object) => void
    onMapClick: () => void
  }) => (
    <div>
      <button type="button" onClick={() => onBoundsChange({
        south: 37.5,
        west: 126.9,
        north: 37.6,
        east: 127,
        zoom: 18,
      })}>
        지도 범위 조회
      </button>
      <button type="button" onClick={onMapClick}>지도 클릭</button>
    </div>
  ),
}))

describe('MapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMapContentsMock.mockResolvedValue({ items: [], has_more: false })
    removeFavoriteMock.mockResolvedValue(undefined)
    saveFavoriteMock.mockResolvedValue({ content_id: 'place-1', is_favorite: true })
    updatePushEnabledMock.mockResolvedValue({ language_code: 'ko', push_enabled: false })
  })

  it('첫 진입 시 위치 안내를 표시하고 거절해도 지도를 이용할 수 있다', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    expect(screen.getByRole('dialog', { name: '현재 위치를 사용해도 될까요?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '나중에' }))

    expect(screen.getByRole('heading', { name: '지도' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toHaveTextContent('지도')
    expect(localStorage.getItem('kgb.location-prompt-completed')).toBe('true')
  })

  it('지도 화면 영역이 바뀌면 백엔드 콘텐츠를 조회한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await waitFor(() => expect(getMapContentsMock).toHaveBeenCalledWith({
      south: 37.5,
      west: 126.9,
      north: 37.6,
      east: 127,
      zoom: 18,
    }))
  })

  it('조회한 장소와 행사를 바텀시트에서 펼쳐 볼 수 있다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    getMapContentsMock.mockResolvedValue({
      items: [
        {
          content_id: 'place-1',
          title: '서울숲',
          content_type: 'PLACE',
          address: '서울 성동구',
          latitude: 37.5444,
          longitude: 127.0374,
          thumbnail_url: null,
          event_period: null,
          is_favorite: false,
        },
        {
          content_id: 'event-1',
          title: '서울 축제',
          content_type: 'EVENT',
          address: '서울 중구',
          latitude: 37.5665,
          longitude: 126.978,
          thumbnail_url: null,
          event_period: { start_date: '2026-09-01', end_date: '2026-09-30' },
          is_favorite: false,
        },
      ],
      has_more: false,
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    expect(await screen.findByText('주변 장소·행사 2개')).toBeInTheDocument()
    expect(screen.getByText('서울숲')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    expect(screen.getByRole('button', { name: '장소 목록 접기' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('서울 축제')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지도 클릭' }))
    expect(document.querySelector('.map-content-sheet--expanded')).not.toBeInTheDocument()
  })

  it('핸들바를 아래로 드래그하면 하단 탭 위까지 축소된다', () => {
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    render(<MemoryRouter><MapPage /></MemoryRouter>)
    const handle = screen.getByRole('button', { name: '장소 목록 펼치기' })

    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 240, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 240, pointerId: 1 })

    expect(document.querySelector('.map-content-sheet--collapsed')).toBeInTheDocument()
  })

  it('조회 결과가 비어 있으면 콘텐츠 미적재 가능성을 안내한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    expect(await screen.findByText('이 지도 영역에 표시할 장소·행사가 없어요')).toBeInTheDocument()
  })

  it('장소를 즐겨찾기에 저장하고 다시 해제한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    getMapContentsMock.mockResolvedValue({
      items: [{
        content_id: 'place-1',
        title: '서울숲',
        content_type: 'PLACE',
        address: '서울 성동구',
        latitude: 37.5444,
        longitude: 127.0374,
        thumbnail_url: null,
        event_period: null,
        is_favorite: false,
      }],
      has_more: false,
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    const saveButton = await screen.findByRole('button', { name: '서울숲 즐겨찾기 저장' })
    await user.click(saveButton)

    await waitFor(() => expect(saveFavoriteMock).toHaveBeenCalledWith('place-1'))
    const removeButton = screen.getByRole('button', { name: '서울숲 즐겨찾기 해제' })
    expect(removeButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(removeButton)
    await waitFor(() => expect(removeFavoriteMock).toHaveBeenCalledWith('place-1'))
    expect(screen.getByRole('button', { name: '서울숲 즐겨찾기 저장' }))
      .toHaveAttribute('aria-pressed', 'false')
  })
})
