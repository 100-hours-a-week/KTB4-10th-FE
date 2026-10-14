import { describe, expect, it } from 'vitest'
import { sanitizeGuidebookForPrint, waitForPrintAssets } from './printContent.ts'

describe('가이드북 인쇄 HTML', () => {
  it('화면 스타일은 유지하고 실행 가능한 요소와 속성은 제거한다', () => {
    const source = `<!doctype html><html><head>
      <style>.page { display: grid }</style>
      <script>alert('실행되면 안 됨')</script>
    </head><body onload="alert('실행되면 안 됨')">
      <img src="https://example.com/place.jpg" onerror="alert('실행되면 안 됨')">
      <a href="javascript:alert('실행되면 안 됨')">장소</a>
      <iframe src="https://example.com"></iframe>
    </body></html>`

    const result = sanitizeGuidebookForPrint(source)

    expect(result).toContain('.page { display: grid }')
    expect(result).toContain('https://example.com/place.jpg')
    expect(result).toContain('loading="eager"')
    expect(result).toContain('name="viewport"')
    expect(result).toContain('data-kgb-print="true"')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('<iframe')
    expect(result).not.toContain('onload=')
    expect(result).not.toContain('onerror=')
    expect(result).not.toContain('javascript:')
  })

  it('이미지 오류가 발생해도 인쇄 준비를 계속한다', async () => {
    const document = new DOMParser().parseFromString(
      '<!doctype html><html><body><img src="https://example.com/missing.jpg"></body></html>',
      'text/html',
    )
    const image = document.images[0]
    Object.defineProperty(image, 'complete', { value: false })

    const waiting = waitForPrintAssets(document, 1000)
    image.dispatchEvent(new Event('error'))

    await expect(waiting).resolves.toBeUndefined()
  })
})
