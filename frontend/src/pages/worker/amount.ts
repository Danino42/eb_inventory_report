// Amounts are kept as the text the worker typed (e.g. "2,5"), so half-typed values like "2,"
// don't jump around. These helpers read and write that text.

import type { Unit } from '../../types/fruit'

/** Above this many kg the field asks "Bist du sicher?" (likely a typo, e.g. 250 instead of 25) */
export const KG_WARNING_LIMIT = 50

/** Only digits (pcs) or digits with one decimal comma/point (kg); no minus sign */
export function isAllowedInput(text: string, unit: Unit): boolean {
  return unit === 'pcs' ? /^\d*$/.test(text) : /^\d*([.,]\d{0,2})?$/.test(text)
}

/** Number value of the text, or null if empty / not a number yet */
export function parseAmount(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Swiss-German style: decimal comma, no trailing zeros (2,5 / 12) */
export function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

/** − / + buttons: change by one, never below zero */
export function stepAmount(text: string, delta: 1 | -1): string {
  const next = Math.max(0, (parseAmount(text) ?? 0) + delta)
  return formatAmount(next)
}

export const UNIT_SHORT: Record<Unit, string> = { kg: 'kg', pcs: 'Stk' }
