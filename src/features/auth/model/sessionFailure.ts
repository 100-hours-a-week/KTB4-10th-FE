import axios from 'axios'

export type SessionFailure = 'UNAUTHORIZED' | 'TEMPORARY'

export function classifySessionFailure(error: unknown): SessionFailure {
  return axios.isAxiosError(error) && error.response?.status === 401
    ? 'UNAUTHORIZED'
    : 'TEMPORARY'
}
