import { BOX_TYPES, type BoxType, type FruitWithDerived } from '../../types/fruit'

/** "months" = the combined month bar (available in at least one box type) */
export type SortKey = 'dev_name' | 'name_de' | 'name_en' | 'unit' | 'months' | BoxType
export type SortDirection = 'asc' | 'desc'
export interface Sort {
  key: SortKey
  direction: SortDirection
}

const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true })

function isBox(key: SortKey): key is BoxType {
  return (BOX_TYPES as readonly string[]).includes(key)
}

/** Season start = first available month; fruits without any month go last */
function seasonStart(months: number[] | undefined): number {
  return months?.[0] ?? 13
}

function compare(a: FruitWithDerived, b: FruitWithDerived, key: SortKey): number {
  if (key === 'months') return seasonStart(a.months) - seasonStart(b.months)
  if (isBox(key)) return seasonStart(a.availability[key]?.months) - seasonStart(b.availability[key]?.months)
  return collator.compare(a[key], b[key])
}

/** Returns a sorted copy; ties fall back to the German name so the order is always stable */
export function sortFruits(fruits: FruitWithDerived[], sort: Sort | null): FruitWithDerived[] {
  if (!sort) return fruits
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...fruits].sort(
    (a, b) => sign * compare(a, b, sort.key) || collator.compare(a.name_de, b.name_de),
  )
}

/** Header click cycle: ascending → descending → original order */
export function nextSort(current: Sort | null, key: SortKey): Sort | null {
  if (current?.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}
