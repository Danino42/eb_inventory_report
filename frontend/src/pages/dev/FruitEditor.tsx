import { useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from 'react'
import { ApiError } from '../../api/client'
import { createFruit, deleteFruit, updateFruit } from '../../api/fruits'
import {
  BOX_LABELS,
  BOX_TYPES,
  CATEGORIES,
  CATEGORY_LABELS,
  MONTHS_EN,
  UNITS,
  UNIT_LABELS,
  VARIANTS,
  VARIANT_LABELS,
  type BoxAvailability,
  type BoxType,
  type Fruit,
} from '../../types/fruit'

interface Props {
  /** null = create a new fruit */
  fruit: Fruit | null
  onClose: () => void
  /** Called with a short confirmation, e.g. "Kiwi saved" */
  onSaved: (message: string) => void
}

const EMPTY_FRUIT: Fruit = {
  dev_name: '',
  name_en: '',
  name_de: '',
  article_number: '',
  note: '',
  unit: 'kg',
  variants: ['conventional', 'bio'],
  availability: {},
}

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** Suggests a dev name from the English name, e.g. "Mini Watermelon" -> "mini_watermelon" */
function toDevName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  // Dev names must start with a letter
  return /^[0-9]/.test(slug) ? `fruit_${slug}` : slug
}

/** Strips derived fields (box_types, months) the API adds, so only stored fields are sent back */
function toDraft(fruit: Fruit): Fruit {
  const { dev_name, name_en, name_de, article_number, note, unit, variants, availability } = fruit
  return {
    dev_name,
    name_en,
    name_de,
    article_number,
    note,
    unit,
    variants: [...variants],
    availability: structuredClone(availability),
  }
}

export function FruitEditor({ fruit, onClose, onSaved }: Props) {
  const isNew = fruit === null
  const [initial] = useState<Fruit>(() => toDraft(fruit ?? EMPTY_FRUIT))
  const [draft, setDraft] = useState<Fruit>(initial)
  // For new fruits the dev name follows the English name until someone edits it by hand
  const [devNameEdited, setDevNameEdited] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function set<K extends keyof Fruit>(key: K, value: Fruit[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function toggleVariant(variant: Fruit['variants'][number]) {
    setDraft((d) => {
      const has = d.variants.includes(variant)
      // At least one of Konventionell / Bio must stay selected
      if (has && d.variants.length === 1) return d
      const variants = has ? d.variants.filter((v) => v !== variant) : [...d.variants, variant]
      return { ...d, variants: VARIANTS.filter((v) => variants.includes(v)) }
    })
  }

  function setEnglishName(name: string) {
    setDraft((d) => ({ ...d, name_en: name, dev_name: devNameEdited ? d.dev_name : toDevName(name) }))
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial)

  /** Close via Cancel or Esc; asks first if something was changed */
  function requestClose() {
    if (isDirty && !window.confirm('Discard your changes?')) return
    onClose()
  }

  function handleEscape(e: SyntheticEvent) {
    e.preventDefault()
    requestClose()
  }

  /** Updates one box type from its latest state (safe for quick repeated taps); undefined removes it */
  function updateBox(box: BoxType, update: (current: BoxAvailability | undefined) => BoxAvailability | undefined) {
    setDraft((d) => {
      const availability = { ...d.availability }
      const next = update(availability[box])
      if (next) availability[box] = next
      else delete availability[box]
      return { ...d, availability }
    })
  }

  function setBox(box: BoxType, value: BoxAvailability | undefined) {
    updateBox(box, () => value)
  }

  function patchBox(box: BoxType, patch: Partial<BoxAvailability>) {
    updateBox(box, (current) => current && { ...current, ...patch })
  }

  function toggleMonth(box: BoxType, month: number) {
    updateBox(box, (current) => {
      if (!current) return current
      const months = current.months.includes(month)
        ? current.months.filter((m) => m !== month)
        : [...current.months, month].sort((a, b) => a - b)
      return { ...current, months }
    })
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onSaved(message)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(`The dev name "${draft.dev_name}" is already used by another fruit. Please choose a different one.`)
      } else {
        setError(e instanceof ApiError ? e.message : "Can't connect to the server. Nothing was saved, please try again.")
      }
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // A box type without any month is the same as not offered
    const availability = Object.fromEntries(
      Object.entries(draft.availability).filter(([, a]) => a.months.length > 0),
    )
    const payload = { ...draft, dev_name: draft.dev_name.trim(), availability }
    run(
      () => (isNew ? createFruit(payload) : updateFruit(fruit.dev_name, payload)),
      `${payload.name_de} ${isNew ? 'added' : 'saved'}`,
    )
  }

  function handleDelete() {
    if (!fruit) return
    if (!window.confirm(`Delete ${fruit.name_de}? It will be removed from the list for everyone.`)) return
    run(() => deleteFruit(fruit.dev_name), `${fruit.name_de} deleted`)
  }

  return (
    <dialog ref={dialogRef} className="editor" onCancel={handleEscape} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{isNew ? 'Add fruit' : `Edit ${fruit.name_de}`}</h2>

        <div className="editor__grid">
          <label>
            German name
            <input value={draft.name_de} onChange={(e) => set('name_de', e.target.value)} required />
          </label>
          <label>
            English name
            <input value={draft.name_en} onChange={(e) => setEnglishName(e.target.value)} required />
          </label>
          <label>
            Dev name
            <input
              value={draft.dev_name}
              onChange={(e) => {
                setDevNameEdited(true)
                set('dev_name', e.target.value)
              }}
              pattern="[a-z][a-z0-9_]*"
              title="Only small letters, numbers and _ (for example apple_gala)"
              required
            />
          </label>
          <label>
            Unit
            <select value={draft.unit} onChange={(e) => set('unit', e.target.value as Fruit['unit'])}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Article number
            <input
              value={draft.article_number}
              onChange={(e) => set('article_number', e.target.value)}
              inputMode="numeric"
            />
          </label>
          <div className="editor__variants">
            <span>Stocked as</span>
            <div className="segmented" role="group" aria-label="Stocked as">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={draft.variants.includes(v)}
                  className={draft.variants.includes(v) ? 'is-active' : ''}
                  onClick={() => toggleVariant(v)}
                >
                  {VARIANT_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <label className="editor__wide">
            Note
            <input value={draft.note} onChange={(e) => set('note', e.target.value)} />
          </label>
        </div>

        <h3>Availability</h3>
        {BOX_TYPES.map((box) => {
          const a = draft.availability[box]
          return (
            <fieldset key={box} className={`editor__box${a ? '' : ' is-off'}`}>
              <legend>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!a}
                    onChange={(e) => setBox(box, e.target.checked ? { category: 'box', months: [] } : undefined)}
                  />
                  {BOX_LABELS[box]}
                </label>
              </legend>
              {a && (
                <>
                  <div className="editor__box-row">
                    <div className="segmented" role="radiogroup" aria-label="Category">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={a.category === c}
                          className={a.category === c ? 'is-active' : ''}
                          onClick={() => patchBox(box, { category: c })}
                        >
                          {CATEGORY_LABELS[c]}
                        </button>
                      ))}
                    </div>
                    <span className="editor__quick">
                      <button type="button" className="btn btn--small" onClick={() => patchBox(box, { months: ALL_MONTHS })}>
                        All year
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => patchBox(box, { months: [] })}>
                        Clear
                      </button>
                    </span>
                  </div>
                  <div className="month-toggles">
                    {MONTHS_EN.map((name, i) => (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={a.months.includes(i + 1)}
                        className={a.months.includes(i + 1) ? 'is-on' : ''}
                        onClick={() => toggleMonth(box, i + 1)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          )
        })}

        {error && <p className="error" role="alert">{error}</p>}

        <footer className="editor__footer">
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={requestClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
