import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getViewer, type Viewer } from '../api/guidebooks.ts'
import { message } from '../model/conditions.ts'
import { State } from './GuidebookLayout.tsx'

const interactionMessage = 'kgb:guidebook-interaction'

function withInteractionBridge(contentHtml: string) {
  const bridge = `<script>(()=>{let x=0,y=0;addEventListener('pointerdown',e=>{x=e.clientX;y=e.clientY},{passive:true});addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-x,e.clientY-y)<10)parent.postMessage('${interactionMessage}','*')},{passive:true})})()</script>`
  return /<\/body\s*>/i.test(contentHtml)
    ? contentHtml.replace(/<\/body\s*>/i, `${bridge}</body>`)
    : `${contentHtml}${bridge}`
}

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
  const viewerRef = useRef<HTMLIFrameElement>(null)
  const viewerHtml = data?.content_html ? withInteractionBridge(data.content_html) : ''

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setControlsVisible(false), 3500)
  }, [])

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

  useEffect(() => {
    const handleInteraction = (event: MessageEvent) => {
      if (event.source === viewerRef.current?.contentWindow && event.data === interactionMessage) revealControls()
    }
    window.addEventListener('message', handleInteraction)
    return () => window.removeEventListener('message', handleInteraction)
  }, [revealControls])

  return <main className="book-viewer-page">
    {error && <State error onRetry={/^[1-9]\d*$/.test(guidebookId) ? () => { setError(''); setRevision((value) => value + 1) } : undefined}>{error}</State>}
    {!data && !error && <State>가이드북을 펼치고 있어요.</State>}
    {data && (data.content_html ? <iframe ref={viewerRef} className="book-viewer" title="가이드북 본문" srcDoc={viewerHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" /> : <State>아직 가이드북 본문이 준비되지 않았어요.</State>)}
    <div className={`book-viewer-controls${controlsVisible ? ' is-visible' : ''}`} aria-hidden={!controlsVisible}>
      <Link className="book-viewer-close" to="/guidebooks" aria-label="가이드북 뷰어 닫기" tabIndex={controlsVisible ? 0 : -1}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </Link>
    </div>
  </main>
}
