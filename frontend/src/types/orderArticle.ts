// Mirrors backend/app/models/order_article.py

/** Units as printed on the supplier order list (Sch = Schale) */
export const ORDER_UNITS = ['kg', 'Stk', 'Sch'] as const
export type OrderUnit = (typeof ORDER_UNITS)[number]

/** One line of the supplier order list; mock data until the Access import exists */
export interface OrderArticle {
  /** Assigned by the server for new articles (later: the Access record id) */
  id: string
  /** Lieferant */
  supplier: string
  /** Artikel / Text */
  text: string
  /** EP: price per unit in CHF */
  unit_price: number
  unit: OrderUnit
  /** EK-Menge: how much is needed */
  ek_quantity: number
  /** Anz. Kisten */
  crates: number | null
  /** Bestellmenge: how much is ordered (less than EK-Menge if enough is in stock) */
  order_quantity: number
  /** Optional link to the fruit catalogue (dev name), e.g. for the icon */
  fruit: string
}
