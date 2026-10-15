import type { EventDetail, EventList } from '../api/events.ts'

export const eventListFixture: EventList = {
  items: [
    { content_id: 'fixture-suwon-night', title: '수원 국가유산 야행', category: 'EVENT', region: { administrative_code: '41', name: '경기도 수원시' }, address: '경기도 수원시 수원화성 일원', thumbnail_url: null, event_period: { start_date: '2026-08-14', end_date: '2026-08-30' } },
    { content_id: 'fixture-gung-festival', title: '궁중문화축전', category: 'EVENT', region: { administrative_code: '11', name: '서울특별시' }, address: '서울특별시 종로구 경복궁', thumbnail_url: null, event_period: { start_date: '2026-10-10', end_date: '2026-10-18' } },
    { content_id: 'fixture-design-miami', title: 'DDP 디자인페어', category: 'EVENT', region: { administrative_code: '11', name: '서울특별시' }, address: '서울특별시 중구 동대문디자인플라자', thumbnail_url: null, event_period: { start_date: '2026-10-23', end_date: '2026-11-01' } },
  ],
  page: 1,
  size: 20,
  total_items: 3,
  total_pages: 1,
}

export function fixtureEventDetail(contentId: string): EventDetail | null {
  const event = eventListFixture.items.find((item) => item.content_id === contentId)
  if (!event) return null
  return {
    ...event,
    address: event.address ?? null,
    latitude: null,
    longitude: null,
    description: `${event.title}에서 다채로운 전시와 공연, 체험 프로그램을 만나보세요. 행사 일정과 프로그램은 주최 측 사정에 따라 변경될 수 있습니다.`,
    phone: null,
    homepage_url: null,
    images: [],
    event_detail: {
      start_date: event.event_period?.start_date ?? null,
      end_date: event.event_period?.end_date ?? null,
      operating_hours: '프로그램별 상이',
      organizer: null,
      organizer_phone: null,
      event_place: event.address ?? null,
    },
  }
}
