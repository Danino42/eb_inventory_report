// The form is counted in three parts, top to bottom, all on one page:
// Konventionell Hauptfrüchte, Bio Hauptfrüchte, then the Add-ons.

import type { FruitWithDerived, Variant } from '../../types/fruit'

export type SectionKey = 'conventional' | 'bio' | 'addons'

export const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'conventional', title: 'Konventionell Hauptfrüchte' },
  { key: 'bio', title: 'Bio Hauptfrüchte' },
  { key: 'addons', title: 'Add-ons' },
]

/** One amount field of the form: a fruit in one variant */
export interface FormLine {
  fruit: FruitWithDerived
  variant: Variant
}

/** An add-on in every box it is in (e.g. Zitrone, Trockenfrüchte; Kiwi is a box fruit in Bio).
    Fruits typed in by hand count as add-ons when they are counted in pieces (Stk). */
function isAddon(fruit: FruitWithDerived): boolean {
  const boxes = Object.values(fruit.availability).filter((b) => b !== undefined)
  return boxes.length > 0 ? boxes.every((b) => b.category === 'addon') : fruit.unit === 'pcs'
}

/** The amount fields of the shown fruits per part, each part in the order of the fruit list */
export function groupLines(fruits: FruitWithDerived[]): Record<SectionKey, FormLine[]> {
  const groups: Record<SectionKey, FormLine[]> = { conventional: [], bio: [], addons: [] }
  for (const fruit of fruits) {
    for (const variant of fruit.variants) {
      groups[isAddon(fruit) ? 'addons' : variant].push({ fruit, variant })
    }
  }
  return groups
}
