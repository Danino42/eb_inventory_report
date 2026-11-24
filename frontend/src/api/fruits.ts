import { rememberUploadedIcons } from '../images/fruitIcons'
import type { Fruit, FruitFilters, FruitWithDerived } from '../types/fruit'
import { API_BASE, request } from './client'

/** Address of an uploaded picture; the version makes a new picture show at once */
export function fruitImageUrl(devName: string, version: string): string {
  return `${API_BASE}/fruits/${encodeURIComponent(devName)}/image?v=${encodeURIComponent(version)}`
}

/** Makes FruitIcon use the uploaded pictures of these fruits */
export function rememberPictures(fruits: FruitWithDerived[]): void {
  rememberUploadedIcons(fruits, fruitImageUrl)
}

export async function listFruits(filters: FruitFilters = {}): Promise<FruitWithDerived[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.size ? `?${params}` : ''
  const fruits = await request<FruitWithDerived[]>(`/fruits${query}`)
  rememberPictures(fruits)
  return fruits
}

export function createFruit(fruit: Fruit): Promise<FruitWithDerived> {
  return request('/fruits', { method: 'POST', body: JSON.stringify(fruit) })
}

/** devName is the current name; fruit.dev_name may differ to rename the fruit */
export function updateFruit(devName: string, fruit: Fruit): Promise<FruitWithDerived> {
  return request(`/fruits/${encodeURIComponent(devName)}`, { method: 'PUT', body: JSON.stringify(fruit) })
}

export function deleteFruit(devName: string): Promise<void> {
  return request(`/fruits/${encodeURIComponent(devName)}`, { method: 'DELETE' })
}

/** Saves the fruit's picture (a square PNG from the cropper) */
export function uploadFruitImage(devName: string, png: Blob): Promise<{ image_version: string }> {
  const form = new FormData()
  form.append('image', png, `${devName}.png`)
  return request(`/fruits/${encodeURIComponent(devName)}/image`, { method: 'PUT', body: form })
}
