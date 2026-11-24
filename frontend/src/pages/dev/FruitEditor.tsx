import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type SyntheticEvent } from 'react'
import { ApiError } from '../../api/client'
import { createFruit, deleteFruit, updateFruit, uploadFruitImage } from '../../api/fruits'
import { FruitIcon } from '../../components/FruitIcon'
import { ImageCropper } from '../../components/ImageCropper'
import { fruitIconUrl } from '../../images/fruitIcons'
import { formatDecimal, useAdminText } from '../../i18n/adminText'
import {
  BOX_LABELS,
  BOX_TYPES,
  CATEGORIES,
  UNITS,
  VARIANTS,
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
  crate_content: 1,
  variants: ['conventional', 'bio'],
  availability: {},
}

/** Larger files are rejected before the browser tries to read them */
const MAX_PICTURE_BYTES = 25_000_000

/** "Inhalt": a number from 0.1 with at most one decimal place ("13,5" or "13.5"); null if not */
function parseCrateContent(text: string): number | null {
  const value = text.trim().replace(',', '.')
  if (!/^\d{1,4}(\.\d)?$/.test(value)) return null
  const n = Number(value)
  return n >= 0.1 && n <= 1000 ? n : null
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

export function FruitEditor({ fruit, onClose, onSaved }: Props) {
  const isNew = fruit === null
  const { t, lang } = useAdminText()
  const [initial] = useState<Fruit>(() => toDraft(fruit ?? EMPTY_FRUIT))
  const [draft, setDraft] = useState<Fruit>(initial)
  // For new fruits the dev name follows the English name until someone edits it by hand
  const [devNameEdited, setDevNameEdited] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  // "Inhalt" as typed (comma or point), checked on saving
  const [crateText, setCrateText] = useState(() => formatDecimal(initial.crate_content, lang))
  // Picture: the chosen file while it is being cropped, then the cropped PNG until saving
  const fileInput = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [picture, setPicture] = useState<{ png: Blob; url: string } | null>(null)
  const objectUrls = useRef<string[]>([])

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Frees the pictures held in memory when the editor closes
  useEffect(() => {
    const urls = objectUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function objectUrl(data: Blob): string {
    const url = URL.createObjectURL(data)
    objectUrls.current.push(url)
    return url
  }

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // the same file can be chosen again
    if (!file) return
    if (file.size > MAX_PICTURE_BYTES) return setError(t.pictureTooLarge)
    setError(null)
    setCropSrc(objectUrl(file))
  }

  function setCrateContent(text: string) {
    setCrateText(text)
    const value = parseCrateContent(text)
    if (value !== null) set('crate_content', value)
  }

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

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial) || picture !== null || cropSrc !== null

  /** Close via Cancel or Esc; asks first if something was changed */
  function requestClose() {
    if (isDirty && !window.confirm(t.discardChanges)) return
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

  /** action resolves with the confirmation to show, e.g. "Kiwi saved" */
  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError(null)
    try {
      onSaved(await action())
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(t.devNameTaken(draft.dev_name))
      } else {
        setError(e instanceof ApiError ? e.message : t.nothingSaved)
      }
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const crateContent = parseCrateContent(crateText)
    if (crateContent === null) return setError(t.crateContentInvalid)
    // A box type without any month is the same as not offered
    const availability = Object.fromEntries(
      Object.entries(draft.availability).filter(([, a]) => a.months.length > 0),
    )
    const payload = { ...draft, crate_content: crateContent, dev_name: draft.dev_name.trim(), availability }
    const shownName = lang === 'de' ? payload.name_de : payload.name_en
    run(async () => {
      await (isNew ? createFruit(payload) : updateFruit(fruit.dev_name, payload))
      if (picture) {
        // The fruit is saved at this point; a failed picture is reported, not undone
        try {
          await uploadFruitImage(payload.dev_name, picture.png)
        } catch (e) {
          return t.savedWithoutPicture(shownName, e instanceof ApiError ? e.message : '')
        }
      }
      return isNew ? t.added(shownName) : t.saved(shownName)
    })
  }

  function handleDelete() {
    if (!fruit) return
    const shownName = lang === 'de' ? fruit.name_de : fruit.name_en
    if (!window.confirm(t.confirmDeleteFruit(shownName))) return
    run(() => deleteFruit(fruit.dev_name).then(() => t.deleted(shownName)))
  }

  return (
    <dialog ref={dialogRef} className="editor" onCancel={handleEscape} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{isNew ? t.addFruit : t.editFruit(lang === 'de' ? fruit.name_de : fruit.name_en)}</h2>

        <div className="editor__grid">
          <label>
            {t.germanName}
            <input value={draft.name_de} onChange={(e) => set('name_de', e.target.value)} required />
          </label>
          <label>
            {t.englishName}
            <input value={draft.name_en} onChange={(e) => setEnglishName(e.target.value)} required />
          </label>
          <label>
            {t.devName}
            <input
              value={draft.dev_name}
              onChange={(e) => {
                setDevNameEdited(true)
                set('dev_name', e.target.value)
              }}
              pattern="[a-z][a-z0-9_]*"
              title={t.devNameHint}
              required
            />
          </label>
          <label>
            {t.unit}
            <select value={draft.unit} onChange={(e) => set('unit', e.target.value as Fruit['unit'])}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t.units[u]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.crateContent}
            <span className="editor__with-unit">
              <input
                value={crateText}
                onChange={(e) => setCrateContent(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                required
              />
              <span>{t.unitShort[draft.unit]}</span>
            </span>
          </label>
          <label>
            {t.articleNumber}
            <input
              value={draft.article_number}
              onChange={(e) => set('article_number', e.target.value)}
              inputMode="numeric"
            />
          </label>
          <div className="editor__variants">
            <span>{t.stockedAs}</span>
            <div className="segmented" role="group" aria-label={t.stockedAs}>
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={draft.variants.includes(v)}
                  className={draft.variants.includes(v) ? 'is-active' : ''}
                  onClick={() => toggleVariant(v)}
                >
                  {t.variants[v]}
                </button>
              ))}
            </div>
          </div>
          <label className="editor__wide">
            {t.note}
            <input value={draft.note} onChange={(e) => set('note', e.target.value)} />
          </label>
          <div className="editor__wide editor__picture">
            <span>{t.picture}</span>
            <div className="editor__picture-row">
              <FruitIcon devName={fruit?.dev_name ?? ''} size={64} src={picture?.url} />
              {!cropSrc && (
                <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                  {picture || (fruit && fruitIconUrl(fruit.dev_name)) ? t.changePicture : t.choosePicture}
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/*,.heic,.heif" hidden onChange={chooseFile} />
            </div>
            {cropSrc && (
              <ImageCropper
                src={cropSrc}
                labels={{ frame: t.picture, zoom: t.zoom, apply: t.applyCrop, cancel: t.cancel }}
                onDone={(png) => {
                  setPicture({ png, url: objectUrl(png) })
                  setCropSrc(null)
                }}
                onCancel={() => setCropSrc(null)}
                onUnreadable={() => {
                  setCropSrc(null)
                  setError(t.pictureUnreadable)
                }}
              />
            )}
          </div>
        </div>

        <h3>{t.availability}</h3>
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
                    <div className="segmented" role="radiogroup" aria-label={t.category}>
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={a.category === c}
                          className={a.category === c ? 'is-active' : ''}
                          onClick={() => patchBox(box, { category: c })}
                        >
                          {t.categories[c]}
                        </button>
                      ))}
                    </div>
                    <span className="editor__quick">
                      <button type="button" className="btn btn--small" onClick={() => patchBox(box, { months: ALL_MONTHS })}>
                        {t.allYear}
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => patchBox(box, { months: [] })}>
                        {t.clearMonths}
                      </button>
                    </span>
                  </div>
                  <div className="month-toggles">
                    {t.monthsShort.map((name, i) => (
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
              {t.delete}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={requestClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t.saving : t.save}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
