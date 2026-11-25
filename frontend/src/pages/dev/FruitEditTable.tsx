import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ApiError } from '../../api/client'
import { createFruit, deleteFruit, updateFruit, uploadFruitImage } from '../../api/fruits'
import { FruitIcon } from '../../components/FruitIcon'
import { ImageCropper } from '../../components/ImageCropper'
import { formatDecimal, useAdminText, type Lang } from '../../i18n/adminText'
import {
  BOX_LABELS,
  BOX_TYPES,
  MONTHS_EN,
  UNITS,
  VARIANTS,
  type BoxType,
  type Fruit,
  type FruitWithDerived,
  type Unit,
  type Variant,
} from '../../types/fruit'
import {
  ALL_MONTHS,
  EMPTY_FRUIT,
  MAX_PICTURE_BYTES,
  NEW_ROW_INPUT_ID,
  offeredOnly,
  parseCrateContent,
  toDraft,
} from './fruitDraft'
import type { Sort, SortKey } from './sortFruits'
import './FruitEditTable.css'

const COLUMN_COUNT = 10

interface Handlers {
  /** The server's answer after a change (it has no picture version) */
  onSaved: (fruit: FruitWithDerived) => void
  onAdded: (fruit: FruitWithDerived) => void
  onDeleted: (fruit: FruitWithDerived) => void
  onPictureSaved: (devName: string, version: string) => void
}

interface TableProps extends Handlers {
  /** In the order to show */
  fruits: FruitWithDerived[]
  sort: Sort | null
  onSort: (key: SortKey) => void
  /** Month outlined in the month cells (the filtered one, else the current one) */
  highlight: number
}

/** "Direkt bearbeiten": every cell is a field, each change is saved on its own; the empty row at
    the end adds new fruits */
export function FruitEditTable({ fruits, sort, onSort, highlight, ...handlers }: TableProps) {
  const { t } = useAdminText()
  const header: { key?: SortKey; label: string }[] = [
    { label: t.picture },
    { key: 'article_number', label: t.colArticleNumber },
    { key: 'name_de', label: t.colGerman },
    { key: 'name_en', label: t.colEnglish },
    { key: 'unit', label: t.unit },
    { key: 'crate_content', label: t.crateContent },
    { label: t.stockedAs },
    { key: 'months', label: t.availability },
    { label: t.note },
    { label: '' },
  ]
  return (
    <div className="table-wrap">
      <table className="edit-table">
        {/* German name, English name and note share the width left over */}
        <colgroup>
          <col className="edit-col--picture" />
          <col className="edit-col--article" />
          <col />
          <col />
          <col className="edit-col--unit" />
          <col className="edit-col--crate" />
          <col className="edit-col--variants" />
          <col className="edit-col--months" />
          <col />
          <col className="edit-col--actions" />
        </colgroup>
        <thead>
          <tr>
            {header.map(({ key, label }, i) => {
              const active = key && sort?.key === key ? sort.direction : null
              return (
                <th
                  key={i}
                  aria-sort={key ? (active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none') : undefined}
                >
                  {key ? (
                    <button
                      type="button"
                      className={`sort-button${active ? ' is-active' : ''}`}
                      onClick={() => onSort(key)}
                    >
                      {label}
                      <span className="sort-button__icon" aria-hidden="true">
                        {active === 'asc' ? '▲' : active === 'desc' ? '▼' : '↕'}
                      </span>
                    </button>
                  ) : (
                    <span className="edit-table__head">{label}</span>
                  )}
                  {key === 'months' && <MonthHeader highlight={highlight} />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {fruits.map((f) => (
            <FruitEditRow key={f.dev_name} fruit={f} highlight={highlight} {...handlers} />
          ))}
        </tbody>
        <tfoot>
          <FruitEditRow fruit={null} highlight={highlight} {...handlers} />
        </tfoot>
      </table>
    </div>
  )
}

/** Month initials above the month cells, on the same grid */
function MonthHeader({ highlight }: { highlight: number }) {
  return (
    <span className="edit-box edit-box--head" aria-hidden="true">
      <span />
      <span className="edit-box__months">
        {MONTHS_EN.map((name, i) => (
          <span key={name} className={i + 1 === highlight ? 'is-highlight' : undefined}>
            {name[0]}
          </span>
        ))}
      </span>
    </span>
  )
}

type Status = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }

interface RowProps extends Handlers {
  /** null = the empty row at the end, which adds a new fruit */
  fruit: FruitWithDerived | null
  highlight: number
}

function shownName(f: Fruit, lang: Lang): string {
  return lang === 'de' ? f.name_de : f.name_en.trim() || f.name_de
}

/** The stored fields in a fixed form, to tell whether anything changed */
function canonical(f: Fruit): string {
  const d = toDraft(f)
  return JSON.stringify({ ...d, availability: offeredOnly(d.availability) })
}

/** One of Konventionell / Bio always stays on */
function toggleVariant(d: Fruit, variant: Variant): Fruit {
  const has = d.variants.includes(variant)
  if (has && d.variants.length === 1) return d
  const variants = has ? d.variants.filter((v) => v !== variant) : [...d.variants, variant]
  return { ...d, variants: VARIANTS.filter((v) => variants.includes(v)) }
}

/** Gives a box type other months; one that was not offered yet starts as box fruit */
function withMonths(d: Fruit, box: BoxType, months: (current: number[]) => number[]): Fruit {
  const current = d.availability[box] ?? { category: 'box' as const, months: [] }
  return {
    ...d,
    availability: { ...d.availability, [box]: { category: current.category, months: months(current.months) } },
  }
}

function toggleMonth(d: Fruit, box: BoxType, month: number): Fruit {
  return withMonths(d, box, (months) =>
    months.includes(month) ? months.filter((m) => m !== month) : [...months, month].sort((a, b) => a - b),
  )
}

/** All twelve months on, or (if they are) all off */
function toggleYear(d: Fruit, box: BoxType): Fruit {
  return withMonths(d, box, (months) => (months.length === ALL_MONTHS.length ? [] : ALL_MONTHS))
}

function toggleAddon(d: Fruit, box: BoxType): Fruit {
  const current = d.availability[box]
  if (!current) return d
  const category = current.category === 'addon' ? 'box' : 'addon'
  return { ...d, availability: { ...d.availability, [box]: { category, months: current.months } } }
}

function FruitEditRow({ fruit, highlight, onSaved, onAdded, onDeleted, onPictureSaved }: RowProps) {
  const { t, lang } = useAdminText()
  const isNew = fruit === null
  const [draft, setDraft] = useState<Fruit>(() => toDraft(fruit ?? EMPTY_FRUIT))
  // "Inhalt" as typed (comma or point), checked when the field is left
  const [crateText, setCrateText] = useState(() => formatDecimal(fruit?.crate_content ?? 1, lang))
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const firstInput = useRef<HTMLInputElement>(null)
  // One request at a time per row; a change made meanwhile is sent right after it
  const busy = useRef(false)
  const queued = useRef<Fruit | null>(null)
  // What the server has, so leaving an unchanged field sends nothing
  const stored = useRef(fruit ? canonical(fruit) : '')

  useEffect(() => {
    if (status.kind !== 'saved') return
    const timer = setTimeout(() => setStatus({ kind: 'idle' }), 2500)
    return () => clearTimeout(timer)
  }, [status])

  /** The draft as the server takes it, or what is missing */
  function payloadOf(d: Fruit, text: string): Fruit | string {
    const name_de = d.name_de.trim()
    if (!name_de) return t.nameRequired
    const crate_content = parseCrateContent(text)
    if (crate_content === null) return t.crateContentInvalid
    return {
      ...d,
      // New fruits get their dev name from the server (made from the name)
      dev_name: fruit?.dev_name ?? '',
      name_de,
      name_en: d.name_en.trim(),
      article_number: d.article_number.trim(),
      note: d.note.trim(),
      crate_content,
      availability: offeredOnly(d.availability),
    }
  }

  function fail(e: unknown) {
    setStatus({ kind: 'error', message: e instanceof ApiError ? e.message : t.nothingSaved })
  }

  async function save(payload: Fruit) {
    if (!fruit) return
    if (busy.current) {
      queued.current = payload
      return
    }
    if (canonical(payload) === stored.current) {
      // Nothing to send; an earlier error (e.g. a name left empty) is fixed by now
      setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s))
      return
    }
    busy.current = true
    setStatus({ kind: 'saving' })
    let ok = false
    try {
      onSaved(await updateFruit(fruit.dev_name, payload))
      stored.current = canonical(payload)
      ok = true
    } catch (e) {
      fail(e)
    }
    busy.current = false
    const next = queued.current
    queued.current = null
    if (next) void save(next)
    else if (ok) setStatus({ kind: 'saved' })
  }

  /** After a change: saves the row (not the new one); next = the draft just made */
  function commit(next: Fruit = draft, text: string = crateText) {
    if (isNew) return
    const payload = payloadOf(next, text)
    if (typeof payload === 'string') setStatus({ kind: 'error', message: payload })
    else void save(payload)
  }

  /** Switches, months and the unit take effect at once */
  function change(update: (d: Fruit) => Fruit) {
    const next = update(draft)
    setDraft(next)
    commit(next)
  }

  async function add() {
    if (busy.current) return
    const payload = payloadOf(draft, crateText)
    if (typeof payload === 'string') return setStatus({ kind: 'error', message: payload })
    busy.current = true
    setStatus({ kind: 'saving' })
    try {
      onAdded(await createFruit(payload))
      setDraft(toDraft(EMPTY_FRUIT))
      setCrateText(formatDecimal(1, lang))
      setStatus({ kind: 'idle' })
      // Ready for the next one
      firstInput.current?.focus()
    } catch (e) {
      fail(e)
    }
    busy.current = false
  }

  async function remove() {
    if (!fruit || !window.confirm(t.confirmDeleteFruit(shownName(fruit, lang)))) return
    try {
      await deleteFruit(fruit.dev_name)
      onDeleted(fruit)
    } catch (e) {
      fail(e)
    }
  }

  /** Enter: leaves the field (which saves it), or adds the new fruit */
  function onEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (isNew) void add()
    else e.currentTarget.blur()
  }

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // the same file can be chosen again
    if (!file) return
    if (file.size > MAX_PICTURE_BYTES) return setStatus({ kind: 'error', message: t.pictureTooLarge })
    setCropSrc(URL.createObjectURL(file))
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function savePicture(png: Blob) {
    closeCropper()
    if (!fruit) return
    setStatus({ kind: 'saving' })
    try {
      const { image_version } = await uploadFruitImage(fruit.dev_name, png)
      onPictureSaved(fruit.dev_name, image_version)
      setStatus({ kind: 'saved' })
    } catch (e) {
      fail(e)
    }
  }

  function textField(key: 'name_en' | 'note', className: string, label: string) {
    return (
      <input
        className={className}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        onBlur={() => commit()}
        onKeyDown={onEnter}
        aria-label={label}
        autoComplete="off"
      />
    )
  }

  // Short sign next to "Löschen": being saved, saved, or something went wrong (said below the row)
  const statusSign = { idle: '', saving: '…', saved: '✓', error: '⚠' }[status.kind]
  const statusTitle = status.kind === 'saving' ? t.saving : status.kind === 'saved' ? t.rowSaved : undefined

  return (
    <>
      <tr className={isNew ? 'edit-table__new' : undefined}>
        <td>
          {fruit ? (
            <>
              <button
                type="button"
                className="edit-table__picture"
                onClick={() => fileInput.current?.click()}
                aria-label={t.pictureOf(shownName(draft, lang))}
                title={t.choosePicture}
              >
                <FruitIcon devName={fruit.dev_name} size={32} />
              </button>
              <input ref={fileInput} type="file" accept="image/*,.heic,.heif" hidden onChange={chooseFile} />
              {cropSrc && (
                <PictureDialog
                  src={cropSrc}
                  title={t.pictureOf(shownName(draft, lang))}
                  onDone={(png) => void savePicture(png)}
                  onClose={closeCropper}
                  onUnreadable={() => {
                    closeCropper()
                    setStatus({ kind: 'error', message: t.pictureUnreadable })
                  }}
                />
              )}
            </>
          ) : (
            <span className="edit-table__picture is-empty" aria-hidden="true" />
          )}
        </td>
        <td>
          <input
            ref={firstInput}
            id={isNew ? NEW_ROW_INPUT_ID : undefined}
            className="edit-table__article"
            value={draft.article_number}
            onChange={(e) => setDraft((d) => ({ ...d, article_number: e.target.value }))}
            onBlur={() => commit()}
            onKeyDown={onEnter}
            inputMode="numeric"
            aria-label={t.articleNumber}
            autoComplete="off"
          />
        </td>
        <td>
          <input
            className={`edit-table__name${!isNew && !draft.name_de.trim() ? ' is-invalid' : ''}`}
            value={draft.name_de}
            onChange={(e) => setDraft((d) => ({ ...d, name_de: e.target.value }))}
            onBlur={() => commit()}
            onKeyDown={onEnter}
            placeholder={isNew ? t.newFruit : undefined}
            aria-label={t.germanName}
            autoComplete="off"
          />
        </td>
        <td>{textField('name_en', 'edit-table__name', t.englishName)}</td>
        <td>
          <select
            value={draft.unit}
            onChange={(e) => change((d) => ({ ...d, unit: e.target.value as Unit }))}
            aria-label={t.unit}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t.unitShort[u]}
              </option>
            ))}
          </select>
        </td>
        <td>
          <span className="edit-table__with-unit">
            <input
              className={`edit-table__crate${parseCrateContent(crateText) === null ? ' is-invalid' : ''}`}
              value={crateText}
              onChange={(e) => setCrateText(e.target.value)}
              onBlur={() => commit()}
              onKeyDown={onEnter}
              inputMode="decimal"
              aria-label={t.crateContentLabel}
              autoComplete="off"
            />
            {t.unitShort[draft.unit]}
          </span>
        </td>
        <td>
          <span className="edit-toggles" role="group" aria-label={t.stockedAs}>
            {VARIANTS.map((v) => {
              const on = draft.variants.includes(v)
              return (
                <button
                  key={v}
                  type="button"
                  className={`edit-toggle${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  title={t.variants[v]}
                  onClick={() => change((d) => toggleVariant(d, v))}
                >
                  {t.variantsShort[v]}
                </button>
              )
            })}
          </span>
        </td>
        <td>
          <div className="edit-boxes">
            {BOX_TYPES.map((box) => {
              const a = draft.availability[box]
              const months = a?.months ?? []
              const addon = a?.category === 'addon'
              return (
                <div key={box} className="edit-box">
                  <button
                    type="button"
                    className="edit-box__label"
                    title={t.wholeYear}
                    onClick={() => change((d) => toggleYear(d, box))}
                  >
                    {BOX_LABELS[box]}
                  </button>
                  <span className="edit-box__months">
                    {ALL_MONTHS.map((m) => {
                      const on = months.includes(m)
                      return (
                        <button
                          key={m}
                          type="button"
                          className={`edit-month${on ? ' is-on' : ''}${m === highlight ? ' is-highlight' : ''}`}
                          aria-pressed={on}
                          aria-label={`${BOX_LABELS[box]} ${t.monthsLong[m - 1]}`}
                          title={t.monthsLong[m - 1]}
                          onClick={() => change((d) => toggleMonth(d, box, m))}
                        />
                      )
                    })}
                  </span>
                  <button
                    type="button"
                    className={`edit-toggle edit-toggle--small${addon ? ' is-on' : ''}`}
                    aria-pressed={addon}
                    aria-label={`${BOX_LABELS[box]} ${t.categories.addon}`}
                    disabled={!months.length}
                    onClick={() => change((d) => toggleAddon(d, box))}
                  >
                    {t.categories.addon}
                  </button>
                </div>
              )
            })}
          </div>
        </td>
        <td>{textField('note', 'edit-table__note', t.note)}</td>
        <td className="edit-table__actions">
          <span className={`edit-table__status is-${status.kind}`} title={statusTitle}>
            {statusSign}
          </span>
          {fruit ? (
            <button type="button" className="link-button" onClick={() => void remove()}>
              {t.delete}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => void add()}
              disabled={status.kind === 'saving'}
            >
              {t.add}
            </button>
          )}
        </td>
      </tr>
      {status.kind === 'error' && (
        <tr className="edit-table__error">
          <td colSpan={COLUMN_COUNT} role="alert">
            {status.message}
          </td>
        </tr>
      )}
    </>
  )
}

interface PictureDialogProps {
  src: string
  title: string
  onDone: (png: Blob) => void
  onClose: () => void
  onUnreadable: () => void
}

/** The cropper of the editor dialog, for a picture chosen in the table */
function PictureDialog({ src, title, onDone, onClose, onUnreadable }: PictureDialogProps) {
  const { t } = useAdminText()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog ref={dialog} className="editor edit-picture" onClose={onClose}>
      <div className="edit-picture__body">
        <h2>{title}</h2>
        <ImageCropper
          src={src}
          labels={{ frame: t.picture, zoom: t.zoom, apply: t.applyCrop, cancel: t.cancel }}
          onDone={onDone}
          onCancel={onClose}
          onUnreadable={onUnreadable}
        />
      </div>
    </dialog>
  )
}
