import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MapPage } from './MapPage.tsx'

const { getMapContentsMock, updatePushEnabledMock } = vi.hoisted(() => ({
  getMapContentsMock: vi.fn(),
  updatePushEnabledMock: vi.fn(),
}))

vi.mock('../api/map.ts', () => ({
  getMapContents: getMapContentsMock,
}))

vi.mock('../api/settings.ts', () => ({
  updatePushEnabled: updatePushEnabledMock,
}))

vi.mock('./KakaoMapCanvas.tsx', () => ({
  KakaoMapCanvas: ({ onBoundsChange }: { onBoundsChange: (bounds: object) => void }) => (
    <button type="button" onClick={() => onBoundsChange({
      south: 37.5,
      west: 126.9,
      north: 37.6,
      east: 127,
      zoom: 18,
    })}>
      지도 범위 조회
    </button>
  ),
}))

describe('MapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMapContentsMock.mockResolvedValue({ items: [], has_more: false })
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
})
