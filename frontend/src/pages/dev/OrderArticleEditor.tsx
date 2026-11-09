import { useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from 'react'
import { ApiError } from '../../api/client'
import { createOrderArticle, deleteOrderArticle, updateOrderArticle } from '../../api/orderArticles'
import { useAdminText } from '../../i18n/adminText'
import type { FruitWithDerived } from '../../types/fruit'
import { ORDER_UNITS, type OrderArticle, type OrderUnit } from '../../types/orderArticle'

interface Props {
  /** null = new article */
  article: OrderArticle | null
  suppliers: string[]
  fruits: FruitWithDerived[]
  onClose: () => void
  onSaved: (message: string) => void
}

/** Numbers are typed as text, so "4,5" and "4.5" both work */
interface Draft {
  supplier: string
  text: string
  unitPrice: string
  unit: OrderUnit
  ekQuantity: string
  crates: string
  orderQuantity: string
  fruit: string
}

const toText = (n: number | null) => (n === null ? '' : String(n))
const parse = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

function toDraft(a: OrderArticle | null): Draft {
  return {
    supplier: a?.supplier ?? '',
    text: a?.text ?? '',
    unitPrice: toText(a?.unit_price ?? null),
    unit: a?.unit ?? 'kg',
    ekQuantity: toText(a?.ek_quantity ?? null),
    crates: toText(a?.crates ?? null),
    orderQuantity: toText(a?.order_quantity ?? null),
    fruit: a?.fruit ?? '',
  }
}

export function OrderArticleEditor({ article, suppliers, fruits, onClose, onSaved }: Props) {
  const isNew = article === null
  const { t } = useAdminText()
  const [initial] = useState(() => toDraft(article))
  const [draft, setDraft] = useState(initial)
  // For new articles the Bestellmenge follows the EK-Menge until it is edited by hand
  const [orderEdited, setOrderEdited] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial)

  function requestClose() {
    if (isDirty && !window.confirm(t.discardChanges)) return
    onClose()
  }

  function handleEscape(e: SyntheticEvent) {
    e.preventDefault()
    requestClose()
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onSaved(message)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.nothingSaved)
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const unitPrice = parse(draft.unitPrice)
    const ek = parse(draft.ekQuantity)
    const order = parse(draft.orderQuantity)
    const crates = parse(draft.crates)
    const numbers = [unitPrice, ek, order, crates]
    if (numbers.some((n) => n !== null && (!Number.isFinite(n) || n < 0))) {
      setError(t.invalidNumbers)
      return
    }
    if (crates !== null && !Number.isInteger(crates)) {
      setError(t.cratesWhole)
      return
    }
    const payload: OrderArticle = {
      id: article?.id ?? '',
      supplier: draft.supplier.trim(),
      text: draft.text.trim(),
      unit_price: unitPrice ?? 0,
      unit: draft.unit,
      ek_quantity: ek ?? 0,
      crates,
      order_quantity: order ?? 0,
      fruit: draft.fruit,
    }
    run(
      () => (isNew ? createOrderArticle(payload) : updateOrderArticle(payload)),
      isNew ? t.added(payload.text) : t.saved(payload.text),
    )
  }

  function handleDelete() {
    if (!article || !window.confirm(t.confirmDeleteArticle(article.text))) return
    run(() => deleteOrderArticle(article.id), t.deleted(article.text))
  }

  const numberProps = { inputMode: 'decimal' as const, autoComplete: 'off', pattern: '[0-9]*[.,]?[0-9]*' }

  return (
    <dialog ref={dialogRef} className="editor" onCancel={handleEscape} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{isNew ? t.addArticle : t.editArticle}</h2>

        <div className="editor__grid">
          <label>
            {t.supplier}
            <input
              value={draft.supplier}
              onChange={(e) => set('supplier', e.target.value)}
              list="order-suppliers"
              required
              autoComplete="off"
            />
            <datalist id="order-suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            {t.unitPriceChf}
            <input value={draft.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} required {...numberProps} />
          </label>
          <label className="editor__wide">
            {t.colArticle}
            <input value={draft.text} onChange={(e) => set('text', e.target.value)} required />
          </label>
          <div className="editor__variants">
            <span>{t.unit}</span>
            <div className="segmented" role="radiogroup" aria-label={t.unit}>
              {ORDER_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={draft.unit === u}
                  className={draft.unit === u ? 'is-active' : ''}
                  onClick={() => set('unit', u)}
                >
                  {t.orderUnits[u]}
                </button>
              ))}
            </div>
          </div>
          <label>
            {t.colCrates}
            <input value={draft.crates} onChange={(e) => set('crates', e.target.value)} {...numberProps} />
          </label>
          <label>
            {t.colNeeded} ({t.orderUnits[draft.unit]})
            <input
              value={draft.ekQuantity}
              onChange={(e) => {
                const value = e.target.value
                setDraft((d) => ({ ...d, ekQuantity: value, orderQuantity: orderEdited ? d.orderQuantity : value }))
              }}
              required
              {...numberProps}
            />
          </label>
          <label>
            {t.colOrdered} ({t.orderUnits[draft.unit]})
            <input
              value={draft.orderQuantity}
              onChange={(e) => {
                setOrderEdited(true)
                set('orderQuantity', e.target.value)
              }}
              required
              {...numberProps}
            />
          </label>
          <label className="editor__wide">
            {t.fruitInCatalogue}
            <select value={draft.fruit} onChange={(e) => set('fruit', e.target.value)}>
              <option value="">—</option>
              {[...fruits]
                .sort((a, b) => a.name_de.localeCompare(b.name_de, 'de'))
                .map((f) => (
                  <option key={f.dev_name} value={f.dev_name}>
                    {f.name_de}
                  </option>
                ))}
              {/* Keep a link that is not (or no longer) in the catalogue selectable */}
              {draft.fruit && !fruits.some((f) => f.dev_name === draft.fruit) && (
                <option value={draft.fruit}>{draft.fruit}</option>
              )}
            </select>
          </label>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

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
