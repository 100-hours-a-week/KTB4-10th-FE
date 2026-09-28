const oauthErrorMessages: Record<string, string> = {
  OAUTH_ACCESS_DENIED: '사용자에 의해 로그인이 취소되었습니다.',
  OAUTH_INVALID_REQUEST: '로그인 요청이 만료되었어요. 다시 시도해 주세요.',
  OAUTH_AUTHENTICATION_FAILED: '로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.',
  OAUTH_PROVIDER_UNAVAILABLE: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
  OAUTH_INTERNAL_ERROR: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
}

export function getOauthErrorMessage(code: string | null): string | null {
  if (code === null) return null
  return oauthErrorMessages[code] ?? '로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.'
}
