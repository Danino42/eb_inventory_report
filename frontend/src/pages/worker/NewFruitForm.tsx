import { useState, type FormEvent } from 'react'
import type { Unit } from '../../types/fruit'
import { UNIT_SHORT } from './amount'

interface Props {
  onAdd: (name: string, unit: Unit) => void
  /** Focus the name field right away (in the pop-up) */
  autoFocus?: boolean
}

/** [ Name der Frucht ] [kg|Stk] [Hinzufügen] — for fruits that are not in the catalogue */
export function NewFruitForm({ onAdd, autoFocus }: Props) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('kg')

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, unit)
    setName('')
    setUnit('kg')
  }

  return (
    <form className="new-fruit" onSubmit={submit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name der Frucht"
        aria-label="Name der neuen Frucht"
        autoComplete="off"
        enterKeyHint="done"
        autoFocus={autoFocus}
      />
      <div className="segmented new-fruit__unit" role="radiogroup" aria-label="Einheit">
        {(['kg', 'pcs'] as const).map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={unit === u}
            className={unit === u ? 'is-active' : ''}
            onClick={() => setUnit(u)}
          >
            {UNIT_SHORT[u]}
          </button>
        ))}
      </div>
      <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
        Hinzufügen
      </button>
    </form>
  )
}
