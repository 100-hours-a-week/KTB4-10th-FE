import { describe, expect, it } from 'vitest'
import { notificationDestination } from './notificationNavigation.ts'

describe('notificationDestination', () => {
  it('관심 행사 변경 알림을 행사 상세 경로로 변환한다', () => {
    expect(notificationDestination('EVENT_CHANGED', 'EVENT', '777', {
      eventReturnTo: '/mypage/notifications',
    })).toEqual({
      pathname: '/events/777',
      state: { returnTo: '/mypage/notifications' },
      actionLabel: '행사 보기',
    })
  })

  it('신규 행사 묶음 알림을 기준일 목록 경로로 변환한다', () => {
    expect(notificationDestination('NEW_EVENTS_ADDED', 'EVENT_LIST', '2026-11-02')).toEqual({
      pathname: '/information?view=new&date=2026-11-02',
      actionLabel: '신규 행사 보기',
    })
  })

  it('가이드북 포함 행사 변경·취소 알림을 안내 상태와 완성 화면으로 변환한다', () => {
    expect(notificationDestination('GUIDEBOOK_EVENT_CHANGED', 'GUIDEBOOK', '81', {
      guidebookReturnTo: '/mypage/notifications',
    })).toEqual({
      pathname: '/guidebooks/81',
      state: {
        guidebookEventNotice: 'changed',
        returnTo: '/mypage/notifications',
      },
      actionLabel: '가이드북 확인',
    })
    expect(notificationDestination('GUIDEBOOK_EVENT_CANCELLED', 'GUIDEBOOK', '82')).toEqual({
      pathname: '/guidebooks/82',
      state: { guidebookEventNotice: 'cancelled' },
      actionLabel: '가이드북 확인',
    })
  })

  it('지원하지 않는 조합과 잘못된 참조 ID는 이동 경로를 만들지 않는다', () => {
    expect(notificationDestination('EVENT_CHANGED', 'GUIDEBOOK', '777')).toBeNull()
    expect(notificationDestination('EVENT_CHANGED', 'EVENT', 'invalid')).toBeNull()
    expect(notificationDestination('UNKNOWN', 'EVENT', '777')).toBeNull()
    expect(notificationDestination('NEW_EVENTS_ADDED', 'EVENT_LIST', '2026-02-30')).toBeNull()
    expect(notificationDestination('NEW_EVENTS_ADDED', 'EVENT', '2026-11-02')).toBeNull()
    expect(notificationDestination('GUIDEBOOK_EVENT_CHANGED', 'EVENT', '81')).toBeNull()
    expect(notificationDestination('GUIDEBOOK_EVENT_CANCELLED', 'GUIDEBOOK', 'invalid')).toBeNull()
  })
})
