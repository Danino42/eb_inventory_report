import type { Fruit, FruitFilters, FruitWithDerived } from '../types/fruit'
import { request } from './client'

export function listFruits(filters: FruitFilters = {}): Promise<FruitWithDerived[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.size ? `?${params}` : ''
  return request(`/fruits${query}`)
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
