import { useEffect, useRef, useState, type FormEvent } from 'react'
import { searchMapContents, type MapSearchContent } from '../api/search.ts'
import { searchKakaoRegions } from '../api/regionSearch.ts'
import {
  mergeMapRegions,
  searchMapRegions,
  type MapSearchRegion,
} from '../model/mapSearchRegions.ts'

type MapSearchPanelProps = {
  onClose: () => void
  onSelectContent: (item: MapSearchContent) => void
  onSelectRegion: (region: MapSearchRegion) => void
}

function contentDescription(item: MapSearchContent): string {
  if (item.event_period) {
    return `${item.event_period.start_date} ~ ${item.event_period.end_date}`
  }
  return item.address || item.region?.name || '주소 정보가 없어요.'
}

export function MapSearchPanel({
  onClose,
  onSelectContent,
  onSelectRegion,
}: MapSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [regions, setRegions] = useState<MapSearchRegion[]>([])
  const [contents, setContents] = useState<MapSearchContent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [hasRegionError, setHasRegionError] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
    return () => requestControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const runSearch = async (normalizedQuery: string) => {
    if (!normalizedQuery) {
      setSubmittedQuery('')
      setRegions([])
      setContents([])
      setHasError(false)
      setHasRegionError(false)
      return
    }

    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setSubmittedQuery(normalizedQuery)
    const serviceRegions = searchMapRegions(normalizedQuery)
    setRegions(serviceRegions)
    setContents([])
    setHasError(false)
    setHasRegionError(false)
    setIsLoading(true)
    try {
      const [regionResult, contentResult] = await Promise.allSettled([
        searchKakaoRegions(normalizedQuery, controller.signal),
        searchMapContents(normalizedQuery, controller.signal),
      ])
      if (requestControllerRef.current !== controller) return
      if (regionResult.status === 'fulfilled') {
        setRegions(mergeMapRegions(serviceRegions, regionResult.value))
      } else if (!controller.signal.aborted) {
        setHasRegionError(true)
      }
      if (contentResult.status === 'fulfilled') {
        setContents(contentResult.value.items)
      } else if (!controller.signal.aborted) {
        setHasError(true)
      }
    } finally {
      if (requestControllerRef.current === controller) setIsLoading(false)
    }
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const normalizedQuery = query.trim().slice(0, 10)
    setQuery(normalizedQuery)
    void runSearch(normalizedQuery)
  }

  const hasResults = regions.length > 0 || contents.length > 0

  return (
    <section className="map-search-panel" aria-label="지도 검색">
      <form className="map-search-panel__form" role="search" onSubmit={submitSearch}>
        <img src="/assets/map-controls/search.png" alt="" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={query}
          maxLength={10}
          placeholder="지역, 행사, 장소 검색"
          aria-label="지역, 행사, 장소 검색"
          onChange={(event) => setQuery(event.target.value.slice(0, 10))}
        />
        <button type="button" className="map-search-panel__close" aria-label="검색 닫기" onClick={onClose}>×</button>
      </form>

      {submittedQuery && (
        <div className="map-search-results" role="region" aria-label="검색 결과" aria-live="polite">
          {regions.length > 0 && (
            <div className="map-search-results__group">
              <h2>지역</h2>
              {regions.map((region) => (
                <button
                  type="button"
                  className="map-search-result"
                  key={region.code}
                  onClick={() => onSelectRegion(region)}
                >
                  <span className="map-search-result__type map-search-result__type--region">지역</span>
                  <span className="map-search-result__body">
                    <strong>{region.label}</strong>
                    <small>{region.fullName}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {hasRegionError && (
            <p className="map-search-results__notice" role="status">
              세부 지역 검색을 불러오지 못했어요. 광역 지역과 행사·장소 결과만 표시합니다.
            </p>
          )}

          {isLoading ? (
            <p className="map-search-results__state" role="status">지역과 행사·장소를 찾고 있어요</p>
          ) : hasError ? (
            <div className="map-search-results__state" role="alert">
              <p>검색 결과를 불러오지 못했어요.</p>
              <button type="button" onClick={() => void runSearch(submittedQuery)}>다시 시도</button>
            </div>
          ) : contents.length > 0 ? (
            <div className="map-search-results__group">
              <h2>행사·장소</h2>
              {contents.map((item) => (
                <button
                  type="button"
                  className="map-search-result"
                  key={item.content_id}
                  onClick={() => onSelectContent(item)}
                >
                  <span className={`map-search-result__type map-search-result__type--${item.content_type.toLowerCase()}`}>
                    {item.content_type === 'EVENT' ? '행사' : '장소'}
                  </span>
                  <span className="map-search-result__body">
                    <strong>{item.title}</strong>
                    <small>{contentDescription(item)}</small>
                  </span>
                  {(item.is_favorite || item.is_in_guidebook) && (
                    <span className="map-search-result__badges" aria-label="콘텐츠 관계">
                      {item.is_favorite && (
                        <span title="즐겨찾기">
                          <img src="/assets/favorite/favorite-selected.png" alt="즐겨찾기" />
                        </span>
                      )}
                      {item.is_in_guidebook && (
                        <span title="가이드북 포함">
                          <img src="/assets/navigation/guidebook.png" alt="가이드북 포함" />
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : !hasResults ? (
            <p className="map-search-results__state">검색 결과가 없어요.</p>
          ) : null}
        </div>
      )}
    </section>
  )
}
