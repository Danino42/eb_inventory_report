import { useEffect, useMemo, useRef, useState } from 'react'
import { FruitIcon } from '../../components/FruitIcon'
import type { FruitWithDerived, Unit } from '../../types/fruit'
import { UNIT_SHORT } from './amount'

interface Props {
  /** Fruits not yet on the form (e.g. out of season) */
  fruits: FruitWithDerived[]
  onAdd: (devName: string) => void
  /** Free text for anything not in the catalogue */
  onAddCustom: (name: string, unit: Unit) => void
  onClose: () => void
}

/** One field: search the catalogue, or add what was typed as a new fruit */
export function AddFruitDialog({ fruits, onAdd, onAddCustom, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const typed = query.trim()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const matches = useMemo(() => {
    const q = typed.toLowerCase()
    const sorted = [...fruits].sort((a, b) => a.name_de.localeCompare(b.name_de, 'de'))
    if (!q) return sorted
    return sorted.filter(
      (f) =>
        f.name_de.toLowerCase().includes(q) ||
        f.name_en.toLowerCase().includes(q) ||
        f.article_number.includes(q),
    )
  }, [fruits, typed])

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose}>
      <div className="sheet__body">
        <header className="sheet__header">
          <h2>Frucht hinzufügen</h2>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
        </header>
        <input
          type="search"
          className="sheet__search"
          placeholder="Suchen oder neue Frucht hinzufügen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <ul className="add-list">
          {typed && (
            <li className="add-list__custom">
              <span className="add-list__name">
                „{typed}“ <span className="muted">neu hinzufügen</span>
              </span>
              {(['kg', 'pcs'] as const).map((unit) => (
                <button key={unit} type="button" className="btn" onClick={() => onAddCustom(typed, unit)}>
                  in {UNIT_SHORT[unit]}
                </button>
              ))}
            </li>
          )}
          {matches.map((f) => (
            <li key={f.dev_name}>
              <button type="button" className="add-list__item" onClick={() => onAdd(f.dev_name)}>
                <FruitIcon devName={f.dev_name} size={36} />
                <span className="add-list__name">{f.name_de}</span>
                <span className="muted">{f.article_number}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
