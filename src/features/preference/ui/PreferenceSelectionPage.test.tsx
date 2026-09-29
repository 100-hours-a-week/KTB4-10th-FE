import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferenceSelectionPage } from './PreferenceSelectionPage.tsx'

const {
  getMemberPreferencesMock,
  getPreferenceOptionsMock,
  replaceMemberPreferencesMock,
} = vi.hoisted(() => ({
  getMemberPreferencesMock: vi.fn(),
  getPreferenceOptionsMock: vi.fn(),
  replaceMemberPreferencesMock: vi.fn(),
}))

vi.mock('../api/preferences.ts', () => ({
  getMemberPreferences: getMemberPreferencesMock,
  getPreferenceOptions: getPreferenceOptionsMock,
  replaceMemberPreferences: replaceMemberPreferencesMock,
}))

const options = [
  { preference_type: 'THEME', code: 'NATURE', label: '자연', parent_code: null, sort_order: 10 },
  { preference_type: 'DETAIL', code: 'NATURE_MOUNTAIN', label: '산', parent_code: 'NATURE', sort_order: 10 },
  { preference_type: 'THEME', code: 'HISTORY', label: '역사', parent_code: null, sort_order: 20 },
  { preference_type: 'DETAIL', code: 'HISTORY_RELIC', label: '역사 유물', parent_code: 'HISTORY', sort_order: 10 },
  { preference_type: 'THEME', code: 'ATTRACTION', label: '관광 명소', parent_code: null, sort_order: 30 },
  { preference_type: 'DETAIL', code: 'ATTRACTION_LANDMARK', label: '랜드마크', parent_code: 'ATTRACTION', sort_order: 10 },
  { preference_type: 'DETAIL', code: 'ATTRACTION_URBAN_CULTURE', label: '도시·지역 문화 관광', parent_code: 'ATTRACTION', sort_order: 20 },
  { preference_type: 'THEME', code: 'EXPERIENCE', label: '체험', parent_code: null, sort_order: 40 },
  { preference_type: 'DETAIL', code: 'EXPERIENCE_CRAFT', label: '공예 체험', parent_code: 'EXPERIENCE', sort_order: 10 },
  { preference_type: 'TRAVEL_STYLE', code: 'RELAXING', label: '여유롭게', parent_code: null, sort_order: 10 },
]

function renderPage(initialEntry: string | { pathname: string; state?: unknown } = '/preferences') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/preferences" element={<PreferenceSelectionPage />} />
        <Route path="/map" element={<h1>지도</h1>} />
        <Route path="/mypage" element={<h1>마이페이지</h1>} />
        <Route path="/guidebooks/new" element={<h1>가이드북 생성</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PreferenceSelectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPreferenceOptionsMock.mockResolvedValue(options)
    getMemberPreferencesMock.mockResolvedValue([])
    replaceMemberPreferencesMock.mockResolvedValue({ status: 'ACTIVE', selections: [] })
  })

  it('선택한 대분류의 중분류를 표시하고 필수 조건 충족 후 저장한다', async () => {
    const user = userEvent.setup()
    renderPage()

    const nextButton = await screen.findByRole('button', { name: '다음' })
    expect(nextButton).toBeDisabled()
    expect(screen.queryByRole('button', { name: '산' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '자연' }))
    expect(screen.getByRole('button', { name: '산' })).toBeInTheDocument()
    expect(nextButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '산' }))
    expect(nextButton).toBeEnabled()
    await user.click(nextButton)

    await waitFor(() => expect(replaceMemberPreferencesMock).toHaveBeenCalledWith([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ]))
    expect(await screen.findByRole('heading', { name: '지도' })).toBeInTheDocument()
  })

  it('대분류는 최대 3개까지만 선택한다', async () => {
    const user = userEvent.setup()
    renderPage()

    for (const label of ['자연', '역사', '관광 명소', '체험']) {
      await user.click(await screen.findByRole('button', { name: label }))
    }

    expect(screen.getByRole('button', { name: '자연' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '역사' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '관광 명소' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '체험' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '도시·지역 문화' })).toBeInTheDocument()
    expect(screen.getByText('최대 3개까지 선택할 수 있어요.')).toBeInTheDocument()
  })

  it('저장된 취향이 있으면 수정 모드의 취소와 저장 버튼을 표시한다', async () => {
    getMemberPreferencesMock.mockResolvedValue([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ])

    renderPage()

    expect(await screen.findByRole('button', { name: '취소' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument()
  })

  it('변경사항이 있는 수정 모드에서 취소하면 확인 후 마이페이지로 이동한다', async () => {
    const user = userEvent.setup()
    getMemberPreferencesMock.mockResolvedValue([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ])
    renderPage()

    await user.click(await screen.findByRole('button', { name: '여유롭게' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    const dialog = screen.getByRole('dialog', { name: '취향 수정을 취소할까요?' })
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '아니요' }))
    expect(dialog).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '여유롭게' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '네' }))
    expect(await screen.findByRole('heading', { name: '마이페이지' })).toBeInTheDocument()
  })

  it('수정사항이 없으면 확인 모달 없이 마이페이지로 이동한다', async () => {
    const user = userEvent.setup()
    getMemberPreferencesMock.mockResolvedValue([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ])
    renderPage()

    await user.click(await screen.findByRole('button', { name: '취소' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '마이페이지' })).toBeInTheDocument()
  })

  it('가이드북 생성 화면에서 진입하면 저장 후 생성 화면으로 돌아간다', async () => {
    const user = userEvent.setup()
    getMemberPreferencesMock.mockResolvedValue([
      { preference_type: 'THEME', preference_code: 'NATURE' },
      { preference_type: 'DETAIL', preference_code: 'NATURE_MOUNTAIN' },
    ])
    renderPage({
      pathname: '/preferences',
      state: { returnTo: '/guidebooks/new', guidebookDraft: { province: '서울특별시' } },
    })

    await user.click(await screen.findByRole('button', { name: '저장' }))

    expect(await screen.findByRole('heading', { name: '가이드북 생성' })).toBeInTheDocument()
  })

  it('취향 조회 실패 후 다시 불러올 수 있다', async () => {
    const user = userEvent.setup()
    getPreferenceOptionsMock
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(options)

    renderPage()

    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }))
    expect(await screen.findByRole('button', { name: '자연' })).toBeInTheDocument()
    expect(getPreferenceOptionsMock).toHaveBeenCalledTimes(2)
  })
})
