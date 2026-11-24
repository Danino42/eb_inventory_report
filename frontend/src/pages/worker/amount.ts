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

/** Step sizes of the − / + buttons */
export type StepDelta = -1 | 1

/** − / + buttons (one unit) and crate taps (one crate): add or take away, never below zero */
export function addAmount(text: string, delta: number): string {
  const next = Math.max(0, (parseAmount(text) ?? 0) + delta)
  return formatAmount(next)
}

export const UNIT_SHORT: Record<Unit, string> = { kg: 'kg', pcs: 'Stk' }

/** What one crate of the fruit holds ("Inhalt" in the Verwaltung); 1 for fruits typed in by
    hand or saved on the tablet before the field existed */
export function crateContent(fruit: { crate_content?: number }): number {
  return fruit.crate_content && fruit.crate_content > 0 ? fruit.crate_content : 1
}

/** The amount as crates: "1 Kiste", "2 Kisten", "1,9 Kisten" (after fine adjustments) */
export function formatCrates(amount: number, perCrate: number): string {
  const crates = Math.round((amount / perCrate) * 10) / 10
  return `${formatAmount(crates)} ${crates === 1 ? 'Kiste' : 'Kisten'}`
}
