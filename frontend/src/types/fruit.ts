// Mirrors backend/app/models/fruit.py

export const BOX_TYPES = ['standard', 'spezial', 'bio'] as const
export type BoxType = (typeof BOX_TYPES)[number]

export const BOX_LABELS: Record<BoxType, string> = {
  standard: 'Standard',
  spezial: 'Spezial',
  bio: 'Bio',
}

// "kg" is the default; Stk. and gram packs are counted as "pcs"
export const UNITS = ['kg', 'pcs'] as const
export type Unit = (typeof UNITS)[number]

export const UNIT_LABELS: Record<Unit, string> = {
  kg: 'kg',
  pcs: 'pcs (pieces)',
}

// "box" = part of the Früchtebox, "addon" = seasonal add-on at extra cost
export const CATEGORIES = ['box', 'addon'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  box: 'Box fruit',
  addon: 'Add-on',
}

/** Index 0 = January (month 1) */
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_EN_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface BoxAvailability {
  category: Category
  /** 1 = January ... 12 = December */
  months: number[]
}

export interface Fruit {
  dev_name: string
  name_en: string
  name_de: string
  note: string
  unit: Unit
  availability: Partial<Record<BoxType, BoxAvailability>>
}

/** What the API returns: the stored fruit plus fields derived from availability */
export interface FruitWithDerived extends Fruit {
  box_types: BoxType[]
  months: number[]
}

export interface FruitFilters {
  month?: number
  box_type?: BoxType
  category?: Category
  unit?: Unit
  q?: string
}
