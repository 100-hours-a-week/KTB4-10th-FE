export const routes = {
  home: '/',
  authComplete: '/auth/complete',
  authError: '/auth/error',
  preferences: '/preferences',
  map: '/map',
  guidebooks: '/guidebooks',
  guidebookCreate: '/guidebooks/new',
  guidebookGenerating: '/guidebooks/generating/:jobId',
  guidebookViewer: '/guidebooks/:guidebookId/viewer',
  myPage: '/mypage',
  guidebookDetail: '/guidebooks/:guidebookId',
} as const
