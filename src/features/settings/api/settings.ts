import { ensureCsrfToken, resetCsrfTokenInitialization } from '../../../shared/api/csrf.ts'
import { clearCachedCurrentMember } from '../../auth/api/auth.ts'
import { http } from '../../../shared/api/http.ts'
import { closeNotificationStream } from '../../notification/api/notifications.ts'

export async function logout(): Promise<void> {
  await ensureCsrfToken()
  await http.post('/api/v1/auth/logout')
  closeNotificationStream()
  resetCsrfTokenInitialization()
  clearCachedCurrentMember()
}

export async function withdrawMember(): Promise<void> {
  await ensureCsrfToken()
  await http.delete('/api/v1/members/me')
  closeNotificationStream()
  resetCsrfTokenInitialization()
  clearCachedCurrentMember()
}
