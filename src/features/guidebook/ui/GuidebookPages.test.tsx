import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidebookCreatePage } from './GuidebookCreatePage.tsx'
import { GuidebookListPage } from './GuidebookListPage.tsx'
import { GuidebookViewerPage } from './GuidebookViewerPage.tsx'
import { GuidebookPrintPage } from './GuidebookPrintPage.tsx'
import { GuidebookDetailPage } from './GuidebookDetailPage.tsx'
import { GuidebookRegeneratePage } from './GuidebookRegeneratePage.tsx'
import { today, dayOffset } from '../model/conditions.ts'

const { createBook, listBooks, deleteBook, getBook, getViewer, regenerateBook, track, trackEvent, getCreditWallet, getMemberPreferences, getPreferenceOptions } = vi.hoisted(() => ({
  createBook: vi.fn(), listBooks: vi.fn(), deleteBook: vi.fn(), getBook: vi.fn(), getViewer: vi.fn(), regenerateBook: vi.fn(), track: vi.fn(), trackEvent: vi.fn(), getCreditWallet: vi.fn(), getMemberPreferences: vi.fn(), getPreferenceOptions: vi.fn(),
}))
vi.mock('../../../shared/lib/analytics.ts', () => ({ trackEvent }))
vi.mock('../api/credits.ts', () => ({ getCreditWallet }))
vi.mock('../api/guidebooks.ts', () => ({ createBook, listBooks, deleteBook, getBook, getViewer, regenerateBook }))
vi.mock('../../preference/api/preferences.ts', () => ({ getMemberPreferences, getPreferenceOptions }))
vi.mock('../model/generation.ts', () => ({
  isRunning: () => false,
  useGeneration: () => ({ track, job: null, error: '', dismiss: vi.fn(), refresh: vi.fn() }),
}))

describe('가이드북 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCreditWallet.mockResolvedValue({ credit_balance: 3, active_job_id: null, can_generate: true })
    getMemberPreferences.mockResolvedValue([{ preference_type: 'THEME', preference_code: 'NATURE' }])
    getPreferenceOptions.mockResolvedValue([{ preference_type: 'THEME', code: 'NATURE', label: '자연', parent_code: null, sort_order: 1 }])
  })

  it('생성권이 0개이면 안내하고 새 생성을 막는다', async () => {
    getCreditWallet.mockResolvedValue({ credit_balance: 0, active_job_id: null, can_generate: false })
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    expect(await screen.findByText('사용 가능한 생성권이 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled()
  })

  it('안내 영역에 저장된 대분류 취향을 배지로 표시한다', async () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    expect(await screen.findByLabelText('저장된 여행 취향')).toHaveTextContent('자연')
    expect(screen.getByRole('link', { name: '취향 수정하기' })).toBeInTheDocument()
  })

  it('브라우저와 관계없이 날짜 형식과 달력 아이콘을 표시한다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    const startInput = screen.getByLabelText('시작일')
    const endInput = screen.getByLabelText('종료일')
    expect(startInput.parentElement).toHaveTextContent('YYYY/MM/DD')
    expect(endInput.parentElement).toHaveTextContent('YYYY/MM/DD')
    expect(startInput.parentElement?.querySelector('img'))
      .toHaveAttribute('src', '/assets/guidebook/calendar.png')
    expect(endInput).toBeDisabled()

    const showPicker = vi.fn()
    Object.defineProperty(startInput, 'showPicker', { value: showPicker })
    fireEvent.click(startInput)
    expect(showPicker).toHaveBeenCalledOnce()

    fireEvent.change(startInput, { target: { value: today() } })
    expect(startInput.parentElement).toHaveTextContent(today().replaceAll('-', '/'))
    expect(endInput).toBeEnabled()

    fireEvent.change(endInput, { target: { value: dayOffset(today(), 2) } })
    expect(endInput.parentElement).toHaveTextContent(dayOffset(today(), 2).replaceAll('-', '/'))

    fireEvent.change(startInput, { target: { value: dayOffset(today(), 1) } })
    expect(endInput).toHaveValue('')
    expect(endInput.parentElement).toHaveTextContent('YYYY/MM/DD')
  })

  it('제공받은 화살표 아이콘을 모든 선택 필드에 표시한다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    for (const label of ['시·도', '시·군·구', '동행', '인원']) {
      expect(screen.getByLabelText(label).parentElement?.querySelector('img'))
        .toHaveAttribute('src', '/assets/guidebook/down-arrow.png')
    }
  })

  it('생성권 조회 실패를 0개로 표시하지 않고 재시도한다', async () => {
    getCreditWallet.mockRejectedValueOnce(new Error('404'))
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    expect(await screen.findByText(/생성권을 확인하지 못했어요/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 조회' }))
    await waitFor(() => expect(screen.queryByText(/생성권을 확인하지 못했어요/)).not.toBeInTheDocument())
    expect(getCreditWallet).toHaveBeenCalledTimes(2)
  })
  it('접수 응답 유실 시 같은 멱등 키와 입력으로 다시 요청한다', async () => {
    createBook.mockRejectedValueOnce(new Error('응답 유실')).mockResolvedValue({ job_id: 31, status: 'PENDING', guidebook_id: null })
    render(<MemoryRouter><Routes>
      <Route path="/" element={<GuidebookCreatePage />} />
      <Route path="/guidebooks/generating/:jobId" element={<p>생성 진행 화면</p>} />
    </Routes></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '경상북도' } })
    fireEvent.change(screen.getByLabelText('시·군·구'), { target: { value: '경주시' } })
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: today() } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: dayOffset(today(), 2) } })
    fireEvent.click(screen.getByRole('button', { name: '생성' }))
    fireEvent.click(await screen.findByRole('button', { name: '같은 요청 다시 확인' }))
    expect(await screen.findByText('생성 진행 화면')).toBeInTheDocument()
    expect(createBook).toHaveBeenCalledTimes(2)
    expect(createBook.mock.calls[0]).toEqual(createBook.mock.calls[1])
    expect(track).toHaveBeenCalledWith(
      { job_id: 31, status: 'PENDING', guidebook_id: null },
      expect.any(Number),
    )
    expect(trackEvent.mock.calls).toEqual([
      ['guidebook_generate_start'],
      ['guidebook_generate_accepted'],
    ])
  })

  it('혼자는 1명, 연인은 2명만 선택하며 시도 변경 시 시군구를 비운다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)
    expect(screen.getByLabelText('인원').querySelectorAll('option')).toHaveLength(1)
    expect(screen.getByLabelText('인원')).toHaveValue('1')
    fireEvent.change(screen.getByLabelText('동행'), { target: { value: 'COUPLE' } })
    expect(screen.getByLabelText('인원')).toHaveValue('2')
    expect(screen.getByLabelText('인원').querySelectorAll('option')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '경상북도' } })
    fireEvent.change(screen.getByLabelText('시·군·구'), { target: { value: '경주시' } })
    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '서울특별시' } })
    expect(screen.getByLabelText('시·군·구')).toHaveValue('')
  })

  it('시도와 시군구를 가나다순으로 표시한다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    const provinceOptions = Array.from(screen.getByLabelText('시·도').querySelectorAll('option'))
      .map((option) => option.textContent)
    expect(provinceOptions.slice(0, 5)).toEqual([
      '시·도 선택', '강원특별자치도', '경기도', '경상남도', '경상북도',
    ])

    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '서울특별시' } })
    const districtOptions = Array.from(screen.getByLabelText('시·군·구').querySelectorAll('option'))
      .map((option) => option.textContent)
    expect(districtOptions.slice(0, 6)).toEqual([
      '시·군·구 선택', '강남구', '강동구', '강북구', '강서구', '관악구',
    ])
  })

  it('필수 조건 전에는 생성 버튼을 비활성화하고 단체는 5명부터 선택한다', () => {
    render(<MemoryRouter><GuidebookCreatePage /></MemoryRouter>)

    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('동행'), { target: { value: 'GROUP' } })
    expect(screen.getByLabelText('인원')).toHaveValue('5')
    expect(screen.getByLabelText('인원').querySelectorAll('option')).toHaveLength(6)
  })

  it('목록의 커서를 사용해 더 불러오고 삭제 확인 후 서버 목록을 갱신한다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValueOnce({ items: [book], next_cursor: 'cursor/1', has_more: true })
      .mockResolvedValueOnce({ items: [{ ...book, guidebook_id: 11, title: '다음 여행' }], next_cursor: null, has_more: false })
      .mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    deleteBook.mockResolvedValue(undefined)
    render(<MemoryRouter><GuidebookListPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '더 보기' }))
    expect(await screen.findByText('다음 여행')).toBeInTheDocument()
    expect(listBooks).toHaveBeenCalledWith('cursor/1', expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('button', { name: '다음 여행 삭제' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('삭제하시겠습니까?')
    expect(deleteBook).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(deleteBook).toHaveBeenCalledWith(11))
    await waitFor(() => expect(screen.queryByText('다음 여행')).not.toBeInTheDocument())
  })

  it('생성권이 있으면 목록의 생성 버튼으로 가이드북 생성 화면에 이동한다', async () => {
    listBooks.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
    render(<MemoryRouter initialEntries={['/guidebooks']}><Routes>
      <Route path="/guidebooks" element={<GuidebookListPage />} />
      <Route path="/guidebooks/new" element={<p>가이드북 생성 화면</p>} />
    </Routes></MemoryRouter>)

    expect(await screen.findByRole('status', { name: '잔여 생성권' })).toHaveTextContent('잔여 생성권3개')
    fireEvent.click(screen.getAllByRole('button', { name: '가이드북 만들기' })[0])
    expect(await screen.findByText('가이드북 생성 화면')).toBeInTheDocument()
  })

  it('생성권이 0개이면 생성 진입 대신 안내하고 쿠폰 등록으로 연결한다', async () => {
    getCreditWallet.mockResolvedValue({ credit_balance: 0, active_job_id: null, can_generate: false })
    listBooks.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
    render(<MemoryRouter initialEntries={['/guidebooks']}><Routes>
      <Route path="/guidebooks" element={<GuidebookListPage />} />
      <Route path="/guidebooks/new" element={<p>가이드북 생성 화면</p>} />
      <Route path="/mypage/coupon" element={<p>쿠폰 등록 화면</p>} />
    </Routes></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('status', { name: '잔여 생성권' }))
      .toHaveTextContent('잔여 생성권0개'))
    const createButtons = screen.getAllByRole('button', { name: '가이드북 만들기' })
    expect(createButtons).toHaveLength(2)

    fireEvent.click(createButtons[0])
    expect(await screen.findByRole('dialog')).toHaveTextContent('생성권이 부족해요')
    expect(screen.queryByText('가이드북 생성 화면')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))

    fireEvent.click(createButtons[1])
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }))
    expect(await screen.findByText('쿠폰 등록 화면')).toBeInTheDocument()
  })

  it('생성권 잔액을 확인하지 못하면 생성 화면의 재검증을 위해 진입을 허용한다', async () => {
    getCreditWallet.mockRejectedValue(new Error('network error'))
    listBooks.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
    render(<MemoryRouter initialEntries={['/guidebooks']}><Routes>
      <Route path="/guidebooks" element={<GuidebookListPage />} />
      <Route path="/guidebooks/new" element={<p>가이드북 생성 화면</p>} />
    </Routes></MemoryRouter>)

    await waitFor(() => expect(getCreditWallet).toHaveBeenCalled())
    fireEvent.click(screen.getAllByRole('button', { name: '가이드북 만들기' })[0])
    expect(await screen.findByText('가이드북 생성 화면')).toBeInTheDocument()
  })

  it('목록의 PDF 저장 버튼은 인쇄 전용 화면을 새 탭으로 연다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    render(<MemoryRouter><GuidebookListPage /></MemoryRouter>)

    const printLink = await screen.findByRole('link', { name: '경주 여행 PDF 저장' })
    expect(printLink).toHaveAttribute('href', '/guidebooks/10/print')
    expect(printLink).toHaveAttribute('target', '_blank')
    expect(printLink).toHaveAttribute('rel', 'noopener')
  })

  it('목록 카드에 가이드북 대표 이미지를 표시한다', async () => {
    const book = {
      guidebook_id: 10,
      title: '경주 여행',
      start_date: '2026-10-01',
      end_date: '2026-10-03',
      thumbnail_url: 'https://example.com/guidebook.jpg',
      companion: 'FRIEND',
    }
    listBooks.mockResolvedValue({ items: [book], next_cursor: null, has_more: false })

    render(<MemoryRouter><GuidebookListPage /></MemoryRouter>)

    await screen.findByText('경주 여행')
    expect(document.querySelector('.book-cover img'))
      .toHaveAttribute('src', 'https://example.com/guidebook.jpg')
  })

  it('목록의 삭제 버튼은 접근성 이름을 유지한 휴지통 아이콘으로 표시한다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    render(<MemoryRouter><GuidebookListPage /></MemoryRouter>)

    const deleteButton = await screen.findByRole('button', { name: '경주 여행 삭제' })
    expect(deleteButton).not.toHaveTextContent('삭제')
    expect(deleteButton.querySelector('img')).toHaveAttribute('src', '/assets/guidebook/bin.png')
  })

  it('알림 토스트에서 이동하면 대상 가이드북 카드를 잠시 강조한다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/guidebooks',
        state: { highlightGuidebookId: 10 },
      }]}>
        <GuidebookListPage />
      </MemoryRouter>,
    )

    const card = (await screen.findByText('경주 여행')).closest('li')
    await waitFor(() => expect(card).toHaveClass('book-card--highlighted'))
  })

  it('Web Push로 이동하면 query의 대상 가이드북 카드를 잠시 강조한다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    render(
      <MemoryRouter initialEntries={['/guidebooks?highlightGuidebookId=10']}>
        <GuidebookListPage />
      </MemoryRouter>,
    )

    const card = (await screen.findByText('경주 여행')).closest('li')
    await waitFor(() => expect(card).toHaveClass('book-card--highlighted'))
  })

  it('대상 가이드북이 다음 커서 페이지에 있으면 자동으로 불러와 강조한다', async () => {
    const first = { guidebook_id: 9, title: '첫 여행', start_date: '2026-09-01', end_date: '2026-09-03', companion: 'FRIEND' }
    const target = { ...first, guidebook_id: 10, title: '경주 여행' }
    listBooks
      .mockResolvedValueOnce({ items: [first], next_cursor: 'cursor/1', has_more: true })
      .mockResolvedValueOnce({ items: [target], next_cursor: null, has_more: false })

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/guidebooks',
        state: { highlightGuidebookId: 10 },
      }]}>
        <GuidebookListPage />
      </MemoryRouter>,
    )

    const card = (await screen.findByText('경주 여행')).closest('li')
    await waitFor(() => expect(card).toHaveClass('book-card--highlighted'))
    expect(listBooks).toHaveBeenNthCalledWith(2, 'cursor/1', expect.any(AbortSignal))
  })

  it('대상 카드가 화면 밖에 있으면 스크롤이 끝난 뒤 강조한다', async () => {
    const book = { guidebook_id: 10, title: '경주 여행', start_date: '2026-10-01', end_date: '2026-10-03', companion: 'FRIEND' }
    listBooks.mockResolvedValue({ items: [book], next_cursor: null, has_more: false })
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 900,
      bottom: 980,
      left: 0,
      right: 360,
      width: 360,
      height: 80,
      x: 0,
      y: 900,
      toJSON: () => ({}),
    })

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/guidebooks',
        state: { highlightGuidebookId: 10 },
      }]}>
        <GuidebookListPage />
      </MemoryRouter>,
    )

    const card = (await screen.findByText('경주 여행')).closest('li')
    expect(card).not.toHaveClass('book-card--highlighted')
    window.dispatchEvent(new Event('scrollend'))
    await waitFor(() => expect(card).toHaveClass('book-card--highlighted'))
    rect.mockRestore()
  })

  it('뷰어는 전체 화면에서 내부 스크립트와 탭 감지를 지원한다', async () => {
    const html = '<!doctype html><html><head><style>h1{color:red}</style></head><body><h1>여행</h1><table><tr><td>일정</td></tr></table></body></html>'
    getViewer.mockResolvedValue({ guidebook_id: 10, content_html: html, version: 1, updated_at: '2026-09-29T00:00:00Z' })
    render(<MemoryRouter initialEntries={['/guidebooks/10/viewer']}><Routes><Route path="/guidebooks/:guidebookId/viewer" element={<GuidebookViewerPage />} /></Routes></MemoryRouter>)
    const viewer = await screen.findByTitle('가이드북 본문') as HTMLIFrameElement
    expect(viewer.getAttribute('srcdoc')).toContain('<body><h1>여행</h1><table><tr><td>일정</td></tr></table>')
    expect(viewer.getAttribute('srcdoc')).toContain('kgb:guidebook-interaction')
    expect(viewer).toHaveAttribute('sandbox', 'allow-scripts')
    expect(screen.queryByRole('link', { name: '가이드북 뷰어 닫기' })).not.toBeInTheDocument()
    await act(async () => { window.dispatchEvent(new MessageEvent('message', { data: 'kgb:guidebook-interaction', source: viewer.contentWindow })) })
    expect(screen.getByRole('link', { name: '가이드북 뷰어 닫기' })).toBeVisible()
  })

  it('완료 화면에서 연 뷰어를 닫으면 완료 화면으로 돌아간다', async () => {
    getViewer.mockResolvedValue({ guidebook_id: 10, content_html: '<p>여행</p>', version: 1, updated_at: '2026-09-29T00:00:00Z' })
    render(<MemoryRouter initialEntries={[{
      pathname: '/guidebooks/10/viewer',
      state: { returnTo: '/guidebooks/10' },
    }]}><Routes>
      <Route path="/guidebooks/:guidebookId/viewer" element={<GuidebookViewerPage />} />
      <Route path="/guidebooks/:guidebookId" element={<p>가이드북 완료 화면</p>} />
    </Routes></MemoryRouter>)

    const viewer = await screen.findByTitle('가이드북 본문') as HTMLIFrameElement
    await act(async () => { window.dispatchEvent(new MessageEvent('message', { data: 'kgb:guidebook-interaction', source: viewer.contentWindow })) })
    fireEvent.click(screen.getByRole('link', { name: '가이드북 뷰어 닫기' }))
    expect(await screen.findByText('가이드북 완료 화면')).toBeInTheDocument()
  })

  it('완료 화면은 재생성 진입과 일자별 대표 장소를 표시한다', async () => {
    getBook.mockResolvedValue({
      guidebook_id: 10,
      title: '경주 여행',
      start_date: '2026-10-20',
      end_date: '2026-10-21',
      people_count: 2,
      thumbnail_url: 'https://example.com/guidebook.jpg',
      regeneration: { remaining_count: 3, expires_at: '2099-10-23T09:10:00Z', available: true },
      itinerary: [{ day_number: 1, itinerary_date: '2026-10-20', items: [
        { item_id: 1, sequence: 1, scheduled_time: null, place_snapshot: { title: '첨성대' } },
        { item_id: 2, sequence: 2, scheduled_time: null, place_snapshot: { title: '대릉원' } },
      ] }],
    })
    render(<MemoryRouter initialEntries={['/guidebooks/10']}><Routes>
      <Route path="/guidebooks/:guidebookId" element={<GuidebookDetailPage />} />
    </Routes></MemoryRouter>)

expect(await screen.findByText('경주 여행')).toBeInTheDocument()
    expect(document.querySelector('.book-summary .book-cover img'))
      .toHaveAttribute('src', 'https://example.com/guidebook.jpg')
    expect(screen.getByText('첨성대 외 1곳')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '재생성 (3회 남음)' })).toHaveAttribute('href', '/guidebooks/10/regenerate')
  })

  it('완료 화면은 재생성 횟수를 모두 사용하면 진입을 막고 사유를 표시한다', async () => {
    getBook.mockResolvedValue({
      guidebook_id: 10,
      title: '경주 여행',
      start_date: '2026-10-20',
      end_date: '2026-10-21',
      people_count: 2,
      thumbnail_url: null,
      regeneration: { remaining_count: 0, expires_at: '2099-10-23T09:10:00Z', available: false },
      itinerary: [],
    })
    render(<MemoryRouter initialEntries={['/guidebooks/10']}><Routes>
      <Route path="/guidebooks/:guidebookId" element={<GuidebookDetailPage />} />
    </Routes></MemoryRouter>)

    expect(await screen.findByRole('button', { name: '재생성 (0회 남음)' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('가이드북 재생성 가능 횟수를 모두 사용했어요.')
    expect(screen.queryByRole('link', { name: /재생성/ })).not.toBeInTheDocument()
  })

  it('재생성은 수정 요청만 필수로 접수하고 기존 진행 화면으로 이동한다', async () => {
    getBook.mockResolvedValue({
      guidebook_id: 10,
      title: '경주 여행',
      start_date: '2026-10-20',
      end_date: '2026-10-21',
      people_count: 2,
      thumbnail_url: null,
      regeneration: { remaining_count: 2, expires_at: '2099-10-23T09:10:00Z', available: true },
      itinerary: [],
    })
    regenerateBook.mockResolvedValue({ job_id: 41, job_type: 'REGENERATION', status: 'PENDING', guidebook_id: 10, current_version: 1 })
    render(<MemoryRouter initialEntries={[{
      pathname: '/guidebooks/10/regenerate',
      state: { returnTo: '/guidebooks/10' },
    }]}><Routes>
      <Route path="/guidebooks/:guidebookId/regenerate" element={<GuidebookRegeneratePage />} />
      <Route path="/guidebooks/generating/:jobId" element={<p>재생성 진행 화면</p>} />
    </Routes></MemoryRouter>)

    expect(screen.queryByLabelText('표지 제목')).not.toBeInTheDocument()
    const submit = await screen.findByRole('button', { name: '수정 요청' })
    await waitFor(() => expect(screen.getByRole('textbox', { name: /수정 요청/ })).toBeEnabled())
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: /수정 요청/ }), { target: { value: '  둘째 날은 더 여유롭게 해 주세요.  ' } })
    fireEvent.click(submit)

    expect(await screen.findByText('재생성 진행 화면')).toBeInTheDocument()
    expect(regenerateBook).toHaveBeenCalledWith(10, '둘째 날은 더 여유롭게 해 주세요.', expect.stringContaining('guidebook-10-regeneration-'))
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ job_id: 41, status: 'PENDING' }), expect.any(Number))
  })

  it('재생성 URL에 직접 접근해도 횟수를 모두 사용하면 입력과 제출을 막는다', async () => {
    getBook.mockResolvedValue({
      guidebook_id: 10,
      title: '경주 여행',
      start_date: '2026-10-20',
      end_date: '2026-10-21',
      people_count: 2,
      thumbnail_url: null,
      regeneration: { remaining_count: 0, expires_at: '2099-10-23T09:10:00Z', available: false },
      itinerary: [],
    })
    render(<MemoryRouter initialEntries={['/guidebooks/10/regenerate']}><Routes>
      <Route path="/guidebooks/:guidebookId/regenerate" element={<GuidebookRegeneratePage />} />
    </Routes></MemoryRouter>)

    expect(await screen.findByText('가이드북 재생성 가능 횟수를 모두 사용했어요.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /수정 요청/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '수정 요청' })).toBeDisabled()
    expect(regenerateBook).not.toHaveBeenCalled()
  })

  it('수정 취소는 재생성을 시작하지 않고 완료 화면으로 돌아간다', async () => {
    render(<MemoryRouter initialEntries={[{
      pathname: '/guidebooks/10/regenerate',
      state: { returnTo: '/guidebooks/10' },
    }]}><Routes>
      <Route path="/guidebooks/:guidebookId/regenerate" element={<GuidebookRegeneratePage />} />
      <Route path="/guidebooks/:guidebookId" element={<p>가이드북 완료 화면</p>} />
    </Routes></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: '수정 취소' }))
    expect(await screen.findByText('가이드북 완료 화면')).toBeInTheDocument()
    expect(regenerateBook).not.toHaveBeenCalled()
  })

  it('인쇄 화면은 가이드북 HTML을 정제해 격리된 문서로 준비한다', async () => {
    const html = '<!doctype html><html><head><title>경주 여행</title></head><body onload="alert(1)"><h1>여행</h1><script>alert(1)</script></body></html>'
    getViewer.mockResolvedValue({ guidebook_id: 10, content_html: html, version: 1, updated_at: '2026-09-29T00:00:00Z' })
    render(<MemoryRouter initialEntries={['/guidebooks/10/print']}><Routes><Route path="/guidebooks/:guidebookId/print" element={<GuidebookPrintPage />} /></Routes></MemoryRouter>)

    const printDocument = await screen.findByTitle('가이드북 인쇄 문서')
    expect(printDocument.getAttribute('srcdoc')).toContain('<h1>여행</h1>')
    expect(printDocument.getAttribute('srcdoc')).not.toContain('<script')
    expect(printDocument.getAttribute('srcdoc')).not.toContain('onload=')
    expect(printDocument).toHaveAttribute('sandbox', 'allow-same-origin allow-modals')
  })
})
