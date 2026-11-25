// Shared by the editor dialog and the "Direkt bearbeiten" table

import { BOX_TYPES, type BoxAvailability, type BoxType, type Fruit } from '../../types/fruit'

export const EMPTY_FRUIT: Fruit = {
  dev_name: '',
  name_en: '',
  name_de: '',
  article_number: '',
  note: '',
  unit: 'kg',
  crate_content: 1,
  variants: ['conventional', 'bio'],
  availability: {},
}

/** First field of the edit table's empty row at the end ("Frucht hinzufügen" jumps there) */
export const NEW_ROW_INPUT_ID = 'new-fruit-article'

/** Larger files are rejected before the browser tries to read them */
export const MAX_PICTURE_BYTES = 25_000_000

export const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** "Inhalt": a number from 0.1 with at most one decimal place ("13,5" or "13.5"); null if not */
export function parseCrateContent(text: string): number | null {
  const value = text.trim().replace(',', '.')
  if (!/^\d{1,4}(\.\d)?$/.test(value)) return null
  const n = Number(value)
  return n >= 0.1 && n <= 1000 ? n : null
}

/** Strips derived fields (box_types, months) the API adds, so only stored fields are sent back */
export function toDraft(fruit: Fruit): Fruit {
  const { dev_name, name_en, name_de, article_number, note, unit, crate_content, variants, availability } = fruit
  return {
    dev_name,
    name_en,
    name_de,
    article_number,
    note,
    unit,
    crate_content: crate_content ?? 1,
    variants: [...variants],
    availability: structuredClone(availability),
  }
}

/** Only the box types with at least one month: a box type without months is not offered */
export function offeredOnly(availability: Fruit['availability']): Fruit['availability'] {
  const offered: Partial<Record<BoxType, BoxAvailability>> = {}
  for (const box of BOX_TYPES) {
    const a = availability[box]
    if (a?.months.length) offered[box] = { category: a.category, months: a.months }
  }
  return offered
}
