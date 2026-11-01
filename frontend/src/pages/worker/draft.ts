// Autosave (F-5): everything typed into the form is kept on the tablet, so a reload, sleep or
// closed app loses nothing. The draft is removed once the report is sent or queued.

import { readJson, removeKey, writeJson } from '../../lib/storage'
import type { FruitWithDerived, Variant } from '../../types/fruit'
import type { IfcoState } from './ifco'

const KEY = 'eb-report-draft-v1'

export interface Draft {
  reportId: string
  reportDate: string
  name: string
  amounts: Record<string, Partial<Record<Variant, string>>>
  added: string[]
  customFruits: FruitWithDerived[]
  nextCustomId: number
  ifco: IfcoState
  hqNotes: string
}

export function loadDraft(): Draft | null {
  const draft = readJson<Draft | null>(KEY, null)
  // Ignore anything that does not look like a draft (e.g. from an older app version)
  return draft && typeof draft.reportId === 'string' && typeof draft.reportDate === 'string' ? draft : null
}

export function saveDraft(draft: Draft): void {
  writeJson(KEY, draft)
}

export function clearDraft(): void {
  removeKey(KEY)
}

/** True if the draft holds anything the worker typed or chose */
export function draftHasEntries(d: Draft, emptyIfco: IfcoState): boolean {
  return (
    d.name !== '' ||
    d.hqNotes.trim() !== '' ||
    d.added.length > 0 ||
    d.customFruits.length > 0 ||
    JSON.stringify(d.ifco) !== JSON.stringify(emptyIfco) ||
    Object.values(d.amounts).some((byVariant) => Object.values(byVariant).some((v) => v))
  )
}
