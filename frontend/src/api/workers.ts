import { request } from './client'

/** Names for the name picker (sorted by the backend) */
export function listWorkers(): Promise<string[]> {
  return request('/workers')
}

export function addWorker(name: string): Promise<{ name: string }> {
  return request('/workers', { method: 'POST', body: JSON.stringify({ name }) })
}

export function renameWorker(name: string, newName: string): Promise<{ name: string }> {
  return request(`/workers/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName }),
  })
}

export function removeWorker(name: string): Promise<void> {
  return request(`/workers/${encodeURIComponent(name)}`, { method: 'DELETE' })
}
