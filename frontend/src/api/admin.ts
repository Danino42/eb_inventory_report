import { request } from './client'

/** Resolves if the PIN is right, otherwise fails with ApiError 401 */
export function checkAdminPin(pin: string): Promise<void> {
  return request('/admin/pin', { method: 'POST', headers: { 'X-Admin-Pin': pin } })
}
