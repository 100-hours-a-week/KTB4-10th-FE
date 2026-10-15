import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapPage } from './MapPage.tsx'
import { clearMapNavigationStates } from '../model/mapNavigationState.ts'

const {
  getMapContentsMock,
  getMapMarkersMock,
  removeFavoriteMock,
  saveFavoriteMock,
  updatePushEnabledMock,
  enableWebPushMock,
  mapCanvasCallbacksMock,
} = vi.hoisted(() => ({
  getMapContentsMock: vi.fn(),
  getMapMarkersMock: vi.fn(),
  removeFavoriteMock: vi.fn(),
  saveFavoriteMock: vi.fn(),
  updatePushEnabledMock: vi.fn(),
  enableWebPushMock: vi.fn(),
  mapCanvasCallbacksMock: vi.fn(),
}))

vi.mock('../api/map.ts', () => ({
  clearMapContentCache: vi.fn(),
  getMapContents: getMapContentsMock,
  getMapMarkers: getMapMarkersMock,
}))

vi.mock('../../member/api/memberSettings.ts', () => ({
  updatePushEnabled: updatePushEnabledMock,
}))

vi.mock('../../notification/model/webPush.ts', () => ({
  enableWebPush: enableWebPushMock,
  webPushErrorMessage: (error: unknown) => error instanceof Error ? error.message : '알림 오류',
}))

vi.mock('../api/favorites.ts', () => ({
  removeFavorite: removeFavoriteMock,
  saveFavorite: saveFavoriteMock,
}))

vi.mock('../../auth/api/auth.ts', () => ({
  getCachedCurrentMember: () => ({ member_id: 1 }),
}))

vi.mock('./KakaoMapCanvas.tsx', () => ({
  KakaoMapCanvas: ({
    onBoundsChange,
    onMapClick,
    onSelectItem,
    focusTarget,
    center,
    initialLevel,
    onViewportChange,
  }: {
    onBoundsChange: (bounds: object) => void
    onMapClick: () => void
    onSelectItem: (item: object) => void
    focusTarget: { latitude: number; longitude: number; requestId: number } | null
    center: { latitude: number; longitude: number }
    initialLevel?: number
    onViewportChange: (viewport: object) => void
  }) => (
    mapCanvasCallbacksMock(onBoundsChange, onMapClick, onSelectItem),
    <div>
      <output aria-label="지도 초기 상태">{`${center.latitude},${center.longitude},${initialLevel ?? 5}`}</output>
      <output aria-label="지도 이동 요청">
        {focusTarget
          ? `${focusTarget.latitude},${focusTarget.longitude},${focusTarget.requestId}`
          : '없음'}
      </output>
      <button type="button" onClick={() => {
        onViewportChange({ center: { latitude: 37.55, longitude: 126.95 }, level: 4 })
        onBoundsChange({
          south: 37.5,
          west: 126.9,
          north: 37.6,
          east: 127,
          zoom: 18,
        })
      }}>
        지도 범위 조회
      </button>
      <button type="button" onClick={onMapClick}>지도 클릭</button>
      <button type="button" onClick={() => onSelectItem({
        content_id: 'place-1',
        title: '서울숲',
        content_type: 'PLACE',
        address: '서울 성동구',
        latitude: 37.5444,
        longitude: 127.0374,
        thumbnail_url: 'https://example.com/seoul-forest.jpg',
        event_period: null,
        is_favorite: false,
        is_in_guidebook: false,
      })}>지도 핀 선택</button>
    </div>
  ),
}))

describe('MapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    clearMapNavigationStates()
    getMapContentsMock.mockResolvedValue({
      items: [], next_cursor: null, has_more: false,
    })
    getMapMarkersMock.mockResolvedValue({ mode: 'MARKER', clusters: [], markers: [] })
    removeFavoriteMock.mockResolvedValue(undefined)
    saveFavoriteMock.mockResolvedValue({ content_id: 'place-1', is_favorite: true })
    updatePushEnabledMock.mockResolvedValue({ language_code: 'ko', push_enabled: false })
    enableWebPushMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('위치 조회가 거절되면 카카오 본사로 중심 이동을 요청한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_, onError: PositionErrorCallback) => onError({} as GeolocationPositionError)),
      },
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '현재 위치로 이동' }))

    expect(screen.getByLabelText('지도 이동 요청'))
      .toHaveTextContent('37.3952969470752,127.110449292622,1')
    expect(screen.getByRole('status', {
      name: '위치 권한이 없어 카카오 본사 인근을 보여드릴게요.',
    })).toBeInTheDocument()
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

  it('첫 진입은 0단계로 유지하고 핀을 선택하면 1단계로 열린다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    getMapContentsMock.mockResolvedValue({
      mode: 'CONTENT',
      clusters: [],
      items: [{
        content_id: 'place-1',
        title: '서울숲',
        content_type: 'PLACE',
        address: '서울 성동구',
        latitude: 37.5444,
        longitude: 127.0374,
        thumbnail_url: 'https://example.com/seoul-forest.jpg',
        event_period: null,
        is_favorite: false,
        is_in_guidebook: false,
      }],
      has_more: false,
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    expect(document.querySelector('.map-content-sheet--collapsed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지도 핀 선택' }))
    expect(await screen.findByText('서울숲')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.map-content-card__thumbnail img'))
      .toHaveAttribute('src', 'https://example.com/seoul-forest.jpg'))
    expect(document.querySelector('.map-content-sheet--default')).toBeInTheDocument()
  })

  it('다른 페이지를 다녀오면 같은 탭 메모리에서 지도와 선택 상태를 복원한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    const firstRender = render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await user.click(screen.getByRole('button', { name: '지도 핀 선택' }))
    expect(document.querySelector('.map-content-sheet--default')).toBeInTheDocument()

    firstRender.unmount()
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    expect(screen.getByLabelText('지도 초기 상태'))
      .toHaveTextContent('37.55,126.95,4')
    expect(screen.getByText('서울숲')).toBeInTheDocument()
    expect(document.querySelector('.map-content-sheet--default')).toBeInTheDocument()
    expect(localStorage.getItem('kgb.map-navigation-state')).toBeNull()
  })

  it('지도 화면 영역이 바뀌면 마커만 조회하고 목록을 펼칠 때 콘텐츠를 조회한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await waitFor(() => expect(getMapMarkersMock).toHaveBeenCalledWith({
      south: 37.5,
      west: 126.9,
      north: 37.6,
      east: 127,
      zoom: 18,
    }))
    expect(getMapContentsMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    expect(getMapContentsMock).toHaveBeenCalledWith({
      south: 37.5,
      west: 126.9,
      north: 37.6,
      east: 127,
    })
    const callbackSets = [0, 1, 2].map((index) => new Set(
      mapCanvasCallbacksMock.mock.calls.map((call) => call[index]),
    ))
    expect(callbackSets.every((callbacks) => callbacks.size === 1)).toBe(true)
  })

  it('광역 줌에서 클러스터 전체 개수와 대표 콘텐츠를 표시한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    getMapMarkersMock.mockResolvedValue({
      mode: 'CLUSTER',
      clusters: [
        { cluster_id: '37:126', latitude: 37.5, longitude: 126.9, count: 120 },
        { cluster_id: '35:129', latitude: 35.1, longitude: 129.0, count: 80 },
      ],
      markers: [],
    })
    getMapContentsMock.mockResolvedValue({
      items: [{
        content_id: 'place-1',
        title: '광역 대표 장소',
        content_type: 'PLACE',
        address: '서울',
        latitude: 37.5,
        longitude: 126.9,
        thumbnail_url: null,
        event_period: null,
        is_favorite: false,
      }],
      next_cursor: null,
      has_more: false,
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))

    expect(await screen.findByText('현재 화면 장소·행사 200개')).toBeInTheDocument()
    expect(screen.getByText('광역 대표 장소')).toBeInTheDocument()
  })

  it('실제 목록 끝에 도달했을 때만 다음 10개를 요청한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    const firstItems = Array.from({ length: 10 }, (_, index) => ({
      content_id: `place-${index + 1}`,
      title: `장소 ${index + 1}`,
      content_type: 'PLACE' as const,
      address: '서울',
      latitude: 37.5444,
      longitude: 127.0374,
      thumbnail_url: `https://example.com/place-${index + 1}.jpg`,
      event_period: null,
      is_favorite: false,
    }))
    getMapContentsMock
      .mockResolvedValueOnce({ items: firstItems, next_cursor: 'cursor-10', has_more: true })
      .mockResolvedValueOnce({
        items: [{ ...firstItems[0], content_id: 'place-11', title: '장소 11' }],
        next_cursor: null,
        has_more: false,
      })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    expect(await screen.findByText('장소 1')).toBeInTheDocument()

    expect(screen.getByText('장소 10')).toBeInTheDocument()
    expect(screen.queryByText('장소 11')).not.toBeInTheDocument()
    expect(document.querySelector('.map-content-card__thumbnail img'))
      .toHaveAttribute('loading', 'lazy')

    const list = screen.getByRole('region', { name: '주변 장소와 행사 목록' })
    Object.defineProperties(list, {
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 899 },
      clientHeight: { configurable: true, value: 100 },
    })
    fireEvent.scroll(list)

    await waitFor(() => expect(getMapContentsMock).toHaveBeenCalledTimes(2))
    expect(getMapContentsMock).toHaveBeenLastCalledWith({
      south: 37.5,
      west: 126.9,
      north: 37.6,
      east: 127,
    }, 'cursor-10')
    expect(await screen.findByText('장소 11', {}, { timeout: 1_000 })).toBeInTheDocument()
  })

  it('조회한 장소와 행사를 바텀시트에서 펼쳐 볼 수 있다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    getMapContentsMock.mockResolvedValue({
      mode: 'CONTENT',
      clusters: [],
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
    getMapMarkersMock.mockResolvedValue({
      mode: 'MARKER',
      clusters: [],
      markers: [
        {
          content_id: 'place-1',
          title: '서울숲',
          content_type: 'PLACE',
          latitude: 37.5444,
          longitude: 127.0374,
          is_favorite: false,
          is_in_guidebook: false,
        },
        {
          content_id: 'event-1',
          title: '서울 축제',
          content_type: 'EVENT',
          latitude: 37.5665,
          longitude: 126.978,
          is_favorite: false,
          is_in_guidebook: false,
        },
      ],
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    expect(await screen.findByText('주변 장소·행사 2개')).toBeInTheDocument()
    expect(screen.getByText('서울숲')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: '장소 목록 접기' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('서울 축제')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지도 클릭' }))
    expect(document.querySelector('.map-content-sheet--expanded')).not.toBeInTheDocument()
  })

  it('장소 선택 후 지도 조작과 시트 전환에도 실제 마커 개수를 유지한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    const markers = [
      {
        content_id: 'place-1',
        title: '서울숲',
        content_type: 'PLACE' as const,
        latitude: 37.5444,
        longitude: 127.0374,
        is_favorite: false,
        is_in_guidebook: false,
      },
      {
        content_id: 'event-1',
        title: '서울 축제',
        content_type: 'EVENT' as const,
        latitude: 37.5665,
        longitude: 126.978,
        is_favorite: false,
        is_in_guidebook: false,
      },
    ]
    getMapMarkersMock
      .mockResolvedValueOnce({ mode: 'MARKER', clusters: [], markers })
      .mockResolvedValueOnce({ mode: 'MARKER', clusters: [], markers: [markers[1]] })
    getMapContentsMock
      .mockResolvedValueOnce({
        items: markers.map((marker) => ({
          ...marker,
          address: '서울',
          thumbnail_url: marker.content_id === 'place-1'
            ? 'https://example.com/seoul-forest.jpg'
            : 'https://example.com/seoul-festival.jpg',
          event_period: null,
        })),
        next_cursor: null,
        has_more: false,
      })
      .mockResolvedValueOnce({
        items: [{
          ...markers[1],
          address: '서울',
          thumbnail_url: 'https://example.com/seoul-festival.jpg',
          event_period: null,
        }],
        next_cursor: null,
        has_more: false,
      })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    expect(await screen.findByText('주변 장소·행사 2개')).toBeInTheDocument()
    expect(document.querySelector('.map-content-sheet--collapsed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    await user.click(await screen.findByRole('button', { name: '서울숲 선택' }))
    expect(document.querySelector('.map-content-sheet--default')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    expect(await screen.findByText('서울숲')).toBeInTheDocument()
    expect(document.querySelector('.map-content-card__thumbnail img'))
      .toHaveAttribute('src', 'https://example.com/seoul-forest.jpg')
    expect(screen.getByText('주변 장소·행사 1개')).toBeInTheDocument()
    expect(screen.queryByText('주변 장소·행사 0개')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    expect(document.querySelector('.map-content-sheet--expanded')).toBeInTheDocument()
    expect(screen.getByText('주변 장소·행사 1개')).toBeInTheDocument()
  })

  it('선택 장소가 없는 1단계는 지도 이동 후 첫 번째 마커 정보를 표시한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kgb.location-prompt-completed', 'true')
    getMapMarkersMock.mockResolvedValue({
      mode: 'MARKER',
      clusters: [],
      markers: [{
        content_id: 'event-1',
        title: '서울 축제',
        content_type: 'EVENT',
        latitude: 37.5665,
        longitude: 126.978,
        is_favorite: false,
        is_in_guidebook: false,
      }],
    })
    getMapContentsMock.mockResolvedValue({
      items: [{
        content_id: 'event-1',
        title: '서울 축제',
        content_type: 'EVENT',
        address: '서울 중구',
        latitude: 37.5665,
        longitude: 126.978,
        thumbnail_url: 'https://example.com/seoul-festival.jpg',
        event_period: null,
        is_favorite: false,
        is_in_guidebook: false,
      }],
      next_cursor: null,
      has_more: false,
    })
    render(<MemoryRouter><MapPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
    await screen.findByRole('region', { name: '주변 장소와 행사 목록' })
    await user.click(screen.getByRole('button', { name: '지도 클릭' }))
    expect(document.querySelector('.map-content-sheet--default')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지도 범위 조회' }))
    expect(await screen.findByText('서울 축제')).toBeInTheDocument()
    expect(document.querySelector('.map-content-card__thumbnail img'))
      .toHaveAttribute('src', 'https://example.com/seoul-festival.jpg')
    expect(screen.getByText('주변 장소·행사 1개')).toBeInTheDocument()
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
      mode: 'CONTENT',
      clusters: [],
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
    await user.click(screen.getByRole('button', { name: '장소 목록 펼치기' }))
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
