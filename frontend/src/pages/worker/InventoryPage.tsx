import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { listFruits } from '../../api/fruits'
import { listWorkers } from '../../api/workers'
import { FruitIcon } from '../../components/FruitIcon'
import { VARIANTS, VARIANT_LABELS, type FruitWithDerived, type Unit, type Variant } from '../../types/fruit'
import { AddFruitDialog } from './AddFruitDialog'
import { NamePicker } from './NamePicker'
import { NewFruitForm } from './NewFruitForm'
import { stepAmount } from './amount'
import { QuantityInput } from './QuantityInput'
import { defaultReportDate, formatReportDate, fromIsoDate } from './reportDate'
import './InventoryPage.css'

const OFFLINE_MESSAGE = 'Keine Verbindung zum Server. Bitte später nochmals versuchen.'

/** A fruit typed in by hand (not in the catalogue); counted in both Konventionell and Bio */
function makeCustomFruit(id: number, name: string, unit: Unit): FruitWithDerived {
  return {
    dev_name: `custom_${id}`,
    name_de: name,
    name_en: name,
    article_number: '',
    note: '',
    unit,
    variants: ['conventional', 'bio'],
    availability: {},
    box_types: [],
    months: [],
  }
}

/** Typed amounts per fruit and variant, e.g. { apple_gala: { conventional: "12", bio: "10" } } */
type Amounts = Record<string, Partial<Record<Variant, string>>>

/** Worker form: digital version of the paper "Warenbestände Lebensmittel" */
export function InventoryPage() {
  const [allFruits, setAllFruits] = useState<FruitWithDerived[]>([])
  const [workers, setWorkers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [reportDate, setReportDate] = useState(defaultReportDate)
  const [name, setName] = useState('')
  const [amounts, setAmounts] = useState<Amounts>({})
  // Catalogue fruits added for this report (not in this month's list)
  const [added, setAdded] = useState<string[]>([])
  // Free-text fruits that are not in the catalogue at all
  const [customFruits, setCustomFruits] = useState<FruitWithDerived[]>([])
  const nextCustomId = useRef(1)
  const [dialog, setDialog] = useState<'none' | 'name' | 'add'>('none')
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([listFruits(), listWorkers()])
      .then(([fruits, names]) => {
        setAllFruits(fruits)
        setWorkers(names)
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE))
      .finally(() => setLoading(false))
  }, [])

  const month = fromIsoDate(reportDate).getMonth() + 1
  // This month's fruits in catalogue order, then the ones added by hand
  const shown = useMemo(() => {
    const seasonal = allFruits.filter((f) => f.months.includes(month))
    const extra = added
      .map((devName) => allFruits.find((f) => f.dev_name === devName))
      .filter((f): f is FruitWithDerived => !!f && !seasonal.includes(f))
    return [...seasonal, ...extra, ...customFruits]
  }, [allFruits, added, customFruits, month])
  const notShown = allFruits.filter((f) => !shown.includes(f))
  const isRemovable = (devName: string) =>
    added.includes(devName) || customFruits.some((f) => f.dev_name === devName)

  const fieldCount = shown.reduce((n, f) => n + f.variants.length, 0)
  const filledCount = shown.reduce(
    (n, f) => n + f.variants.filter((v) => (amounts[f.dev_name]?.[v] ?? '') !== '').length,
    0,
  )

  function setAmount(devName: string, variant: Variant, value: string) {
    setAmounts((a) => ({ ...a, [devName]: { ...a[devName], [variant]: value } }))
  }

  function stepFor(devName: string, variant: Variant, delta: 1 | -1) {
    setAmounts((a) => ({
      ...a,
      [devName]: { ...a[devName], [variant]: stepAmount(a[devName]?.[variant] ?? '', delta) },
    }))
  }

  function removeAdded(devName: string) {
    setAdded((list) => list.filter((d) => d !== devName))
    setCustomFruits((list) => list.filter((f) => f.dev_name !== devName))
    setAmounts(({ [devName]: _removed, ...rest }) => rest)
  }

  function addCustom(name: string, unit: Unit) {
    setCustomFruits((list) => [...list, makeCustomFruit(nextCustomId.current++, name, unit)])
  }

  const { weekday, date } = formatReportDate(reportDate)

  return (
    <div className="inventory">
      <header className="inventory__header">
        <div className="inventory__title">
          <h1>Warenbestand</h1>
          <button
            type="button"
            className="inventory__date"
            onClick={() => {
              const input = dateInputRef.current
              if (input?.showPicker) input.showPicker()
              else input?.focus()
            }}
          >
            <strong>{weekday}</strong> {date}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="visually-hidden"
            value={reportDate}
            onChange={(e) => e.target.value && setReportDate(e.target.value)}
            tabIndex={-1}
            aria-label="Datum ändern"
          />
        </div>
        <button
          type="button"
          className={`inventory__name${name ? '' : ' is-empty'}`}
          onClick={() => setDialog('name')}
        >
          {name || 'Name wählen'}
        </button>
      </header>

      {!loading && !error && (
        <p className="inventory__progress">
          <span>
            {filledCount} / {fieldCount} erfasst
          </span>
          <span className="inventory__bar" aria-hidden="true">
            <span style={{ width: `${fieldCount ? (filledCount / fieldCount) * 100 : 0}%` }} />
          </span>
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Laden…</p>}

      {!loading && !error && (
        <section className="stock" aria-label="Früchte">
          <div className="stock__head" aria-hidden="true">
            <span>Frucht</span>
            {VARIANTS.map((v) => (
              <span key={v}>{VARIANT_LABELS[v]}</span>
            ))}
          </div>
          <ul className="stock__list">
            {shown.map((f) => (
              <li key={f.dev_name} className="stock__row">
                <div className="stock__fruit">
                  <FruitIcon devName={f.dev_name} size={44} />
                  <div>
                    <span className="stock__name">{f.name_de}</span>
                    <span className="stock__meta">
                      {f.article_number || 'Eigene Eingabe'}
                      {isRemovable(f.dev_name) && (
                        <button type="button" className="link-button" onClick={() => removeAdded(f.dev_name)}>
                          Entfernen
                        </button>
                      )}
                    </span>
                  </div>
                </div>
                {VARIANTS.map((v) => (
                  <div key={v} className="stock__cell">
                    {f.variants.includes(v) && (
                      <QuantityInput
                        value={amounts[f.dev_name]?.[v] ?? ''}
                        unit={f.unit}
                        onChange={(value) => setAmount(f.dev_name, v, value)}
                        onStep={(delta) => stepFor(f.dev_name, v, delta)}
                        label={`${f.name_de} ${VARIANT_LABELS[v]}`}
                      />
                    )}
                  </div>
                ))}
              </li>
            ))}
            <li className="stock__row stock__row--new">
              <div className="stock__fruit">
                <FruitIcon devName="" size={44} />
                <span className="stock__name">Neue Frucht</span>
              </div>
              <div className="stock__new-form">
                <NewFruitForm onAdd={addCustom} />
              </div>
            </li>
          </ul>
          <button type="button" className="stock__add" onClick={() => setDialog('add')}>
            + Frucht aus der Liste
          </button>
        </section>
      )}

      {dialog === 'name' && (
        <NamePicker
          names={workers}
          current={name}
          onPick={(picked) => {
            setName(picked)
            setDialog('none')
          }}
          onClose={() => setDialog('none')}
        />
      )}
      {dialog === 'add' && (
        <AddFruitDialog
          fruits={notShown}
          onAdd={(devName) => {
            setAdded((list) => [...list, devName])
            setDialog('none')
          }}
          onAddCustom={(customName, unit) => {
            addCustom(customName, unit)
            setDialog('none')
          }}
          onClose={() => setDialog('none')}
        />
      )}
    </div>
  )
}
