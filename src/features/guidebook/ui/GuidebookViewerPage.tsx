import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Toast } from '../../../shared/ui/Toast.tsx'
import { getViewer, type Viewer } from '../api/guidebooks.ts'
import { message } from '../model/conditions.ts'
import { BookHeader, State } from './GuidebookLayout.tsx'

export function GuidebookViewerPage() {
  const { guidebookId = '' } = useParams()
  return <ViewerContent key={guidebookId} guidebookId={guidebookId} />
}

function ViewerContent({ guidebookId }: { guidebookId: string }) {
  const [data, setData] = useState<Viewer | null>(null)
  const [error, setError] = useState(/^[1-9]\d*$/.test(guidebookId) ? '' : '잘못된 가이드북 주소예요.')
  const [revision, setRevision] = useState(0)
  const [toast, setToast] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    if (!/^[1-9]\d*$/.test(guidebookId)) return
    void getViewer(guidebookId, controller.signal).then((value) => { if (!controller.signal.aborted) setData(value) })
      .catch((reason) => { if (!controller.signal.aborted) setError(message(reason)) })
    return () => controller.abort()
  }, [guidebookId, revision])
  return <main className="app-shell book-viewer-page">
    <BookHeader title="가이드북"><button className="book-pdf" onClick={() => setToast(true)}>PDF</button></BookHeader>
    {error && <State error onRetry={/^[1-9]\d*$/.test(guidebookId) ? () => { setError(''); setRevision((value) => value + 1) } : undefined}>{error}</State>}
    {!data && !error && <State>가이드북을 펼치고 있어요.</State>}
    {data && (data.content_html ? <iframe className="book-viewer" title="가이드북 본문" srcDoc={data.content_html} sandbox="" referrerPolicy="no-referrer" /> : <State>아직 가이드북 본문이 준비되지 않았어요.</State>)}
    {toast && <Toast message="PDF 다운로드는 준비 중이에요" onDismiss={() => setToast(false)} />}
  </main>
}
