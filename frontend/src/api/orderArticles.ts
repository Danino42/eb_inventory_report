import type { OrderArticle } from '../types/orderArticle'
import { request } from './client'

export function listOrderArticles(): Promise<OrderArticle[]> {
  return request('/order-articles')
}

/** id may be empty: the server assigns one */
export function createOrderArticle(article: OrderArticle): Promise<OrderArticle> {
  return request('/order-articles', { method: 'POST', body: JSON.stringify(article) })
}

export function updateOrderArticle(article: OrderArticle): Promise<OrderArticle> {
  return request(`/order-articles/${encodeURIComponent(article.id)}`, {
    method: 'PUT',
    body: JSON.stringify(article),
  })
}

export function deleteOrderArticle(id: string): Promise<void> {
  return request(`/order-articles/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
