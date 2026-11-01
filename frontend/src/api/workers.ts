import { request } from './client'

/** Names for the name picker (sorted by the backend) */
export function listWorkers(): Promise<string[]> {
  return request('/workers')
}
