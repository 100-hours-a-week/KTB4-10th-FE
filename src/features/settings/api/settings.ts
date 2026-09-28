import { ensureCsrfToken, resetCsrfTokenInitialization } from '../../../shared/api/csrf.ts'
import { http } from '../../../shared/api/http.ts'

export async function logout(): Promise<void> {
  await ensureCsrfToken()
  await http.post('/api/v1/auth/logout')
  resetCsrfTokenInitialization()
}

export async function withdrawMember(): Promise<void> {
  await ensureCsrfToken()
  await http.delete('/api/v1/members/me')
  resetCsrfTokenInitialization()
}
