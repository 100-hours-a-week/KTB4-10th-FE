import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGenerationStreamUrl,
  openGenerationStream,
  parseGenerationEvent,
} from './guidebooks.ts'

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []
  readonly url: string
  readonly withCredentials: boolean
  close = vi.fn()

  constructor(url: string | URL, options?: EventSourceInit) {
    super()
    this.url = String(url)
    this.withCredentials = options?.withCredentials ?? false
    FakeEventSource.instances.push(this)
  }
}

describe('생성 전용 SSE API', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  it('jobId 전용 주소로 인증 정보를 포함해 연결한다', () => {
    const stream = openGenerationStream(31)

    expect(stream).toBe(FakeEventSource.instances[0])
    expect(FakeEventSource.instances[0].url).toBe(getGenerationStreamUrl(31))
    expect(FakeEventSource.instances[0].url).toContain('/api/v1/guidebook-generations/31/stream')
    expect(FakeEventSource.instances[0].withCredentials).toBe(true)
  })

  it('백엔드 generation-status 이벤트를 검증해 파싱한다', () => {
    expect(parseGenerationEvent(JSON.stringify({
      job_id: 31,
      request_id: '31-0',
      sequence: 2,
      status: 'PROCESSING',
      progress: { step: 'writing', message: '가이드북 문구를 작성하고 있어요.' },
      guidebook_id: null,
      code: null,
    }))).toEqual(expect.objectContaining({
      job_id: 31,
      status: 'PROCESSING',
      sequence: 2,
    }))
  })

  it('잘못된 상태나 진행 단계는 무시한다', () => {
    const base = {
      job_id: 31,
      request_id: '31-0',
      sequence: 1,
      progress: null,
      guidebook_id: null,
      code: null,
    }
    expect(parseGenerationEvent(JSON.stringify({ ...base, status: 'UNKNOWN' }))).toBeNull()
    expect(parseGenerationEvent(JSON.stringify({
      ...base,
      status: 'PROCESSING',
      progress: { step: 'unknown', message: '진행 중' },
    }))).toBeNull()
  })
})
