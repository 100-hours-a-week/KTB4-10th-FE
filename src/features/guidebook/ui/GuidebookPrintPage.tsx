import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getViewer } from '../api/guidebooks.ts'
import { sanitizeGuidebookForPrint, waitForPrintAssets } from '../lib/printContent.ts'
import { message } from '../model/conditions.ts'
import { State } from './GuidebookLayout.tsx'

const PRINT_NOTICE_DELAY_MS = 2000

export function GuidebookPrintPage() {
  const { guidebookId = '' } = useParams()
  const [printHtml, setPrintHtml] = useState('')
  const [error, setError] = useState(/^[1-9]\d*$/.test(guidebookId)
    ? ''
    : '잘못된 가이드북 주소예요.')
  const [revision, setRevision] = useState(0)
  const [printFinished, setPrintFinished] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const hasRequestedPrint = useRef(false)
  const fallbackTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    hasRequestedPrint.current = false
    if (!/^[1-9]\d*$/.test(guidebookId)) return () => controller.abort()

    void getViewer(guidebookId, controller.signal)
      .then((viewer) => {
        if (!controller.signal.aborted) {
          if (!viewer.content_html) setError('아직 가이드북 본문이 준비되지 않았어요.')
          else setPrintHtml(sanitizeGuidebookForPrint(viewer.content_html))
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason))
      })
    return () => controller.abort()
  }, [guidebookId, revision])

  const openPrintDialog = () => {
    const frame = frameRef.current
    const frameWindow = frame?.contentWindow
    if (!frameWindow) return

    setPrintFinished(false)
    if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current)

    const handleAfterPrint = () => {
      setPrintFinished(true)
      window.close()
    }
    frameWindow.addEventListener('afterprint', handleAfterPrint, { once: true })
    frameWindow.focus()
    frameWindow.print()
    fallbackTimerRef.current = window.setTimeout(() => setPrintFinished(true), 1500)
  }

  const handlePrintFrameLoad = async () => {
    const frameDocument = frameRef.current?.contentDocument
    if (!frameDocument || hasRequestedPrint.current) return

    hasRequestedPrint.current = true
    frameDocument.title = frameDocument.title.trim() || `KGB_가이드북_${guidebookId}`
    await waitForPrintAssets(frameDocument)
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await new Promise<void>((resolve) => window.setTimeout(resolve, PRINT_NOTICE_DELAY_MS))

    openPrintDialog()
  }

  const retry = /^[1-9]\d*$/.test(guidebookId)
    ? () => {
      setError('')
      setPrintHtml('')
      setRevision((value) => value + 1)
    }
    : undefined

  return (
    <main className="book-print-page">
      {error && <State error onRetry={retry}>{error}</State>}
      {!printHtml && !error && <State>인쇄용 가이드북을 준비하고 있어요.</State>}
      {printHtml && (
        <>
          {!printFinished && (
            <section className="book-print-notice" role="status" aria-live="polite">
              <strong>PDF 저장 안내</strong>
              <p>
                <span>깔끔한 가이드북을 저장하고 싶으시면</span>
                <span>저장 시 <b>‘머리글과 바닥글’</b>을 해제해 주세요!</span>
              </p>
              <small>잠시 후 인쇄 창이 자동으로 열려요.</small>
            </section>
          )}
          {printFinished && (
            <div className="book-print-fallback">
              <h1>인쇄 창이 열리지 않았나요?</h1>
              <p>
                <span>모바일 브라우저가 자동 실행을 제한했다면</span>
                <span>아래 버튼으로 다시 열어 주세요.</span>
              </p>
              <button className="primary-button" type="button" onClick={openPrintDialog}>인쇄 창 다시 열기</button>
              <Link className="secondary-button" to="/guidebooks">가이드북으로 돌아가기</Link>
            </div>
          )}
          <iframe
            ref={frameRef}
            className="book-print-frame"
            title="가이드북 인쇄 문서"
            srcDoc={printHtml}
            sandbox="allow-same-origin allow-modals"
            referrerPolicy="no-referrer"
            onLoad={() => void handlePrintFrameLoad()}
          />
        </>
      )}
    </main>
  )
}
