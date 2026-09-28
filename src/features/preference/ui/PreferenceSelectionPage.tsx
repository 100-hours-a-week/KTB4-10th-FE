import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '../../../shared/config/routes.ts'
import { Toast } from '../../../shared/ui/Toast.tsx'
import {
  getMemberPreferences,
  getPreferenceOptions,
  replaceMemberPreferences,
  type PreferenceOption,
  type PreferenceSelection,
} from '../api/preferences.ts'

const MAX_THEME_SELECTIONS = 3
const MAX_DETAIL_SELECTIONS = 3

function sortOptions(options: PreferenceOption[]): PreferenceOption[] {
  return [...options].sort((left, right) => left.sort_order - right.sort_order)
}

function getOptionDisplayLabel(option: PreferenceOption): string {
  return option.code === 'ATTRACTION_URBAN_CULTURE'
    ? '도시·지역 문화'
    : option.label
}

export function PreferenceSelectionPage() {
  const navigate = useNavigate()
  const [options, setOptions] = useState<PreferenceOption[]>([])
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({})
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [limitFeedbackCode, setLimitFeedbackCode] = useState<string | null>(null)
  const [limitNotice, setLimitNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadPreferences = useCallback(async () => {
    try {
      const [preferenceOptions, currentSelections] = await Promise.all([
        getPreferenceOptions(),
        getMemberPreferences(),
      ])
      const themes = currentSelections
        .filter(({ preference_type }) => preference_type === 'THEME')
        .map(({ preference_code }) => preference_code)
      const detailsByTheme = currentSelections
        .filter(({ preference_type }) => preference_type === 'DETAIL')
        .reduce<Record<string, string[]>>((result, { preference_code }) => {
          const option = preferenceOptions.find(({ code }) => code === preference_code)
          if (option?.parent_code && themes.includes(option.parent_code)) {
            result[option.parent_code] = [...(result[option.parent_code] ?? []), preference_code]
          }
          return result
        }, {})

      setOptions(preferenceOptions)
      setIsEditMode(currentSelections.length > 0)
      setSelectedThemes(themes)
      setSelectedDetails(detailsByTheme)
      setSelectedStyles(
        currentSelections
          .filter(({ preference_type }) => preference_type === 'TRAVEL_STYLE')
          .map(({ preference_code }) => preference_code),
      )
    } catch {
      setLoadError('취향 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const retryLoadPreferences = () => {
    setIsLoading(true)
    setLoadError(null)
    void loadPreferences()
  }

  useEffect(() => {
    // 라우트 진입 시 서버의 옵션과 저장값을 동기화해야 하는 데이터 조회 Effect입니다.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadPreferences()
  }, [loadPreferences])

  const themes = useMemo(
    () => sortOptions(options.filter(({ preference_type }) => preference_type === 'THEME')),
    [options],
  )
  const travelStyles = useMemo(
    () => sortOptions(options.filter(({ preference_type }) => preference_type === 'TRAVEL_STYLE')),
    [options],
  )
  const detailsByTheme = useMemo(
    () => Object.fromEntries(selectedThemes.map((themeCode) => [
      themeCode,
      sortOptions(options.filter(({ preference_type, parent_code }) => (
        preference_type === 'DETAIL' && parent_code === themeCode
      ))),
    ])),
    [options, selectedThemes],
  )
  const optionLabels = useMemo(
    () => new Map(options.map(({ code, label }) => [code, label])),
    [options],
  )
  const canSubmit = selectedThemes.length >= 1
    && selectedThemes.length <= MAX_THEME_SELECTIONS
    && selectedThemes.every((themeCode) => {
      const detailCount = selectedDetails[themeCode]?.length ?? 0
      return detailCount >= 1 && detailCount <= MAX_DETAIL_SELECTIONS
    })

  const showLimitFeedback = (code: string) => {
    setLimitFeedbackCode(code)
    setLimitNotice('최대 3개까지 선택할 수 있어요.')
    window.setTimeout(() => {
      setLimitFeedbackCode((current) => current === code ? null : current)
    }, 320)
  }

  const toggleTheme = (themeCode: string) => {
    setSubmitError(null)
    if (!selectedThemes.includes(themeCode) && selectedThemes.length >= MAX_THEME_SELECTIONS) {
      showLimitFeedback(themeCode)
      return
    }

    setSelectedThemes((current) => {
      if (current.includes(themeCode)) {
        setSelectedDetails((details) => {
          const next = { ...details }
          delete next[themeCode]
          return next
        })
        return current.filter((code) => code !== themeCode)
      }

      return [...current, themeCode]
    })
  }

  const toggleDetail = (themeCode: string, detailCode: string) => {
    setSubmitError(null)
    const currentDetails = selectedDetails[themeCode] ?? []
    if (!currentDetails.includes(detailCode) && currentDetails.length >= MAX_DETAIL_SELECTIONS) {
      showLimitFeedback(detailCode)
      return
    }

    setSelectedDetails((current) => {
      const selected = current[themeCode] ?? []
      if (selected.includes(detailCode)) {
        return {
          ...current,
          [themeCode]: selected.filter((code) => code !== detailCode),
        }
      }

      return { ...current, [themeCode]: [...selected, detailCode] }
    })
  }

  const toggleStyle = (styleCode: string) => {
    setSubmitError(null)
    setSelectedStyles((current) => (
      current.includes(styleCode)
        ? current.filter((code) => code !== styleCode)
        : [...current, styleCode]
    ))
  }

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return

    const selections: PreferenceSelection[] = [
      ...selectedThemes.map((preference_code) => ({
        preference_type: 'THEME' as const,
        preference_code,
      })),
      ...selectedThemes.flatMap((themeCode) => (
        selectedDetails[themeCode] ?? []
      ).map((preference_code) => ({
        preference_type: 'DETAIL' as const,
        preference_code,
      }))),
      ...selectedStyles.map((preference_code) => ({
        preference_type: 'TRAVEL_STYLE' as const,
        preference_code,
      })),
    ]

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await replaceMemberPreferences(selections)
      navigate(routes.map, { replace: true })
    } catch {
      setSubmitError('취향을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell preference-page">
      <header className="preference-header">
        <h1>취향 선택</h1>
      </header>

      <div className="preference-content">
        <p className="preference-intro">
          여행 취향을 알려주시면<br />첫 가이드북을 더 잘 추천할 수 있어요.
        </p>

        {isLoading && (
          <div className="preference-state" role="status">
            <img className="loading-indicator" src="/assets/loading-indicator.svg" alt="" />
            취향 정보를 불러오고 있어요.
          </div>
        )}

        {!isLoading && loadError && (
          <div className="preference-state" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={retryLoadPreferences}>다시 불러오기</button>
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            <section className="preference-section" aria-labelledby="theme-title">
              <h2 id="theme-title">어떤 여행을 좋아하세요?</h2>
              <p className="preference-guide">최소 1개, 최대 3개까지 선택할 수 있어요.</p>
              <div className="preference-chip-grid preference-chip-grid--three">
                {themes.map((option) => (
                  <button
                    className={`preference-chip${limitFeedbackCode === option.code ? ' preference-chip--limit' : ''}`}
                    type="button"
                    key={option.code}
                    aria-pressed={selectedThemes.includes(option.code)}
                    onClick={() => toggleTheme(option.code)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            {selectedThemes.length > 0 && (
              <section className="preference-section preference-section--divided" aria-labelledby="detail-title">
                <h2 id="detail-title">조금 더 좁혀볼까요?</h2>
                <p className="preference-guide">선택한 카테고리마다 1~3개를 골라 주세요.</p>
                {selectedThemes.map((themeCode) => (
                  <div className="preference-detail-group" key={themeCode}>
                    <h3>↳ {optionLabels.get(themeCode)}</h3>
                    <div className="preference-chip-grid preference-chip-grid--three">
                      {detailsByTheme[themeCode]?.map((option) => (
                        <button
                          className={`preference-chip preference-chip--small${limitFeedbackCode === option.code ? ' preference-chip--limit' : ''}`}
                          type="button"
                          key={option.code}
                          aria-pressed={(selectedDetails[themeCode] ?? []).includes(option.code)}
                          onClick={() => toggleDetail(themeCode, option.code)}
                        >
                          {getOptionDisplayLabel(option)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="preference-section preference-section--divided" aria-labelledby="style-title">
              <h2 id="style-title">어떤 여행 스타일인가요?</h2>
              <p className="preference-guide">선택하지 않아도 괜찮아요.</p>
              <div className="preference-chip-grid preference-chip-grid--two">
                {travelStyles.map((option) => (
                  <button
                    className="preference-chip"
                    type="button"
                    key={option.code}
                    aria-pressed={selectedStyles.includes(option.code)}
                    onClick={() => toggleStyle(option.code)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="preference-footer">
        {submitError && <p role="alert">{submitError}</p>}
        <div className={isEditMode ? 'preference-footer__actions' : undefined}>
          {isEditMode && (
            <button className="secondary-button" type="button" onClick={() => navigate(routes.map)}>
              취소
            </button>
          )}
          <button
            className="primary-button"
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? '저장하고 있어요' : isEditMode ? '저장' : '다음'}
          </button>
        </div>
      </footer>
      {limitNotice && (
        <Toast message={limitNotice} onDismiss={() => setLimitNotice(null)} />
      )}
    </main>
  )
}
