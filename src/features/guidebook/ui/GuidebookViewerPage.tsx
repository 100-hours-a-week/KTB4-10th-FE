import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getViewer, type Viewer } from '../api/guidebooks.ts'
import { message } from '../model/conditions.ts'
import { State } from './GuidebookLayout.tsx'

export function GuidebookViewerPage() {
  const { guidebookId = '' } = useParams()
  return <ViewerContent key={guidebookId} guidebookId={guidebookId} />
}

function ViewerContent({ guidebookId }: { guidebookId: string }) {
  const [data, setData] = useState<Viewer | null>(null)
  const [error, setError] = useState(/^[1-9]\d*$/.test(guidebookId) ? '' : '잘못된 가이드북 주소예요.')
  const [revision, setRevision] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(false)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const revealControls = () => {
    setControlsVisible(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setControlsVisible(false), 3500)
  }

  useEffect(() => {
    const controller = new AbortController()
    if (!/^[1-9]\d*$/.test(guidebookId)) return
    void getViewer(guidebookId, controller.signal).then((value) => { if (!controller.signal.aborted) setData(value) })
      .catch((reason) => { if (!controller.signal.aborted) setError(message(reason)) })
    return () => controller.abort()
  }, [guidebookId, revision])

  useEffect(() => () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
  }, [])

  return <main className="book-viewer-page">
    {error && <State error onRetry={/^[1-9]\d*$/.test(guidebookId) ? () => { setError(''); setRevision((value) => value + 1) } : undefined}>{error}</State>}
    {!data && !error && <State>가이드북을 펼치고 있어요.</State>}
    {data && (data.content_html ? <iframe className="book-viewer" title="가이드북 본문" srcDoc={data.content_html} sandbox="" referrerPolicy="no-referrer" /> : <State>아직 가이드북 본문이 준비되지 않았어요.</State>)}
    {data?.content_html && !controlsVisible && <button className="book-viewer-reveal" type="button" aria-label="뷰어 컨트롤 보이기" onClick={revealControls} />}
    <div className={`book-viewer-controls${controlsVisible ? ' is-visible' : ''}`} aria-hidden={!controlsVisible}>
      <Link className="book-viewer-close" to="/guidebooks" aria-label="가이드북 뷰어 닫기" tabIndex={controlsVisible ? 0 : -1}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </Link>
    </div>
  </main>
}
