import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, isTemporaryFailure } from '../../api/client'
import { sendReport, type InventoryReport, type ReportResult } from '../../api/reports'
import { FruitIcon } from '../../components/FruitIcon'
import { enqueueReport } from '../../lib/reportQueue'
import { newId } from '../../lib/storage'
import { VARIANTS, VARIANT_LABELS, type FruitWithDerived, type Unit, type Variant } from '../../types/fruit'
import { AddFruitDialog } from './AddFruitDialog'
import { EMPTY_IFCO, type IfcoState } from './ifco'
import { IfcoSection } from './IfcoSection'
import { NamePicker } from './NamePicker'
import { NewFruitForm } from './NewFruitForm'
import { parseAmount, stepAmount, type StepDelta } from './amount'
import { QuantityInput } from './QuantityInput'
import { ReviewDialog } from './ReviewDialog'
import { clearDraft, draftHasEntries, loadDraft, saveDraft, type Draft } from './draft'
import { loadFormData } from './offlineData'
import { defaultReportDate, formatReportDate, fromIsoDate } from './reportDate'
import './InventoryPage.css'

const OFFLINE_MESSAGE = 'Keine Verbindung zum Server und noch keine gespeicherte Früchteliste.'
const SEND_TIMEOUT_MS = 20_000

/** Empty form for a new report */
function emptyDraft(): Draft {
  return {
    reportId: newId(),
    reportDate: defaultReportDate(),
    name: '',
    amounts: {},
    added: [],
    customFruits: [],
    nextCustomId: 1,
    ifco: EMPTY_IFCO,
    hqNotes: '',
  }
}

/**
 * The saved draft is continued automatically if it belongs to today's report. A draft from an
 * earlier day is not restored silently (the next shift could send old numbers): the worker decides.
 */
function initialState(): { start: Draft; stale: Draft | null } {
  const saved = loadDraft()
  if (!saved) return { start: emptyDraft(), stale: null }
  if (saved.reportDate === defaultReportDate()) return { start: saved, stale: null }
  return { start: emptyDraft(), stale: draftHasEntries(saved, EMPTY_IFCO) ? saved : null }
}

/** After sending: emailed, saved on the server (no email set up), or waiting on the tablet */
type SentState = { kind: 'sent' | 'saved'; result: ReportResult; at: Date } | { kind: 'queued'; at: Date }

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
  // True when the server is unreachable and the fruit list saved on the tablet is used
  const [offline, setOffline] = useState(false)

  const [initial] = useState(initialState)
  // An unsent draft from an earlier day: the worker chooses to continue or discard it
  const [staleDraft, setStaleDraft] = useState<Draft | null>(initial.stale)
  const [reportId, setReportId] = useState(initial.start.reportId)
  const [reportDate, setReportDate] = useState(initial.start.reportDate)
  const [name, setName] = useState(initial.start.name)
  const [amounts, setAmounts] = useState<Amounts>(initial.start.amounts)
  // Catalogue fruits added for this report (not in this month's list)
  const [added, setAdded] = useState<string[]>(initial.start.added)
  // Free-text fruits that are not in the catalogue at all
  const [customFruits, setCustomFruits] = useState<FruitWithDerived[]>(initial.start.customFruits)
  const nextCustomId = useRef(initial.start.nextCustomId)
  const [ifco, setIfco] = useState<IfcoState>(initial.start.ifco)
  const [hqNotes, setHqNotes] = useState(initial.start.hqNotes)
  const [dialog, setDialog] = useState<'none' | 'name' | 'add' | 'review'>('none')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // Set after sending: shows the confirmation instead of the form
  const [sent, setSent] = useState<SentState | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFormData()
      .then((data) => {
        setAllFruits(data.fruits)
        setWorkers(data.workers)
        setOffline(data.fromCache)
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE))
      .finally(() => setLoading(false))
  }, [])

  // Autosave (F-5): every change is written to the tablet right away. Not while the old-draft
  // question is open (that draft must not be overwritten yet), and not after sending.
  useEffect(() => {
    if (staleDraft || sent) return
    saveDraft({
      reportId,
      reportDate,
      name,
      amounts,
      added,
      customFruits,
      nextCustomId: nextCustomId.current,
      ifco,
      hqNotes,
    })
  }, [staleDraft, sent, reportId, reportDate, name, amounts, added, customFruits, ifco, hqNotes])

  /** Puts a draft (restored or new) into the form */
  function applyDraft(d: Draft) {
    setReportId(d.reportId)
    setReportDate(d.reportDate)
    setName(d.name)
    setAmounts(d.amounts)
    setAdded(d.added)
    setCustomFruits(d.customFruits)
    nextCustomId.current = d.nextCustomId
    setIfco(d.ifco)
    setHqNotes(d.hqNotes)
  }

  const month = fromIsoDate(reportDate).getMonth() + 1
  // The IFCO check is only done in the Monday report (Sunday→Monday night shift)
  const isMonday = fromIsoDate(reportDate).getDay() === 1
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

  function stepFor(devName: string, variant: Variant, delta: StepDelta) {
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

  /** The form as the backend expects it: one line per amount field, in form order */
  function buildReport(): InventoryReport {
    return {
      report_id: reportId,
      report_date: reportDate,
      worker: name.trim(),
      lines: shown.flatMap((f) =>
        f.variants.map((variant) => ({
          article_number: f.article_number,
          dev_name: f.dev_name,
          name_de: f.name_de,
          unit: f.unit,
          variant,
          quantity: parseAmount(amounts[f.dev_name]?.[variant] ?? ''),
          custom: f.dev_name.startsWith('custom_'),
        })),
      ),
      ifco: isMonday
        ? {
            returned: parseAmount(ifco.returned),
            enough_clean: ifco.enoughClean,
            reorder_small: ifco.reorderSmall,
            reorder_large: ifco.reorderLarge,
          }
        : null,
      hq_notes: hqNotes.trim(),
    }
  }

  async function send() {
    const report = buildReport()
    setSending(true)
    setSendError(null)
    try {
      const result = await sendReport(report, SEND_TIMEOUT_MS)
      clearDraft()
      setSent({ kind: result.delivery, result, at: new Date() })
      setDialog('none')
    } catch (e) {
      if (isTemporaryFailure(e) && enqueueReport(report)) {
        // Offline (F-4): the report waits on the tablet and is sent automatically later
        clearDraft()
        setSent({ kind: 'queued', at: new Date() })
        setDialog('none')
      } else {
        setSendError(e instanceof ApiError ? e.message : 'Der Bericht konnte nicht gespeichert werden.')
      }
    } finally {
      setSending(false)
    }
  }

  /** Clears everything for the next report (date and lists start fresh) */
  function startNewReport() {
    applyDraft(emptyDraft())
    setSent(null)
  }

  const { weekday, date } = formatReportDate(reportDate)
  const navigate = useNavigate()

  if (staleDraft) {
    const old = formatReportDate(staleDraft.reportDate)
    return (
      <div className="inventory sent">
        <h1>Nicht gesendeter Bericht</h1>
        <p>
          <strong>
            {old.weekday} {old.date}
          </strong>
          {staleDraft.name && (
            <>
              <br />
              {staleDraft.name}
            </>
          )}
        </p>
        <div className="sent__actions">
          <button
            type="button"
            className="btn sent__home"
            onClick={() => {
              clearDraft()
              setStaleDraft(null)
            }}
          >
            Verwerfen
          </button>
          <button
            type="button"
            className="btn btn--primary sent__new"
            onClick={() => {
              applyDraft(staleDraft)
              setStaleDraft(null)
            }}
          >
            Fortsetzen
          </button>
        </div>
      </div>
    )
  }

  if (sent) {
    const time = sent.at.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    return (
      <div className="inventory sent">
        <h1>
          {sent.kind === 'sent'
            ? `Gesendet um ${time}`
            : sent.kind === 'saved'
              ? `Gespeichert um ${time}`
              : `Offline gespeichert um ${time}`}
        </h1>
        <p>
          <strong>{sent.kind === 'queued' ? `Warenbestand ${weekday} ${date}` : sent.result.subject}</strong>
          <br />
          {sent.kind === 'sent'
            ? `an ${sent.result.recipients.join(', ')}`
            : sent.kind === 'saved'
              ? 'E-Mail-Versand ist noch nicht eingerichtet. PDF und CSV liegen auf dem Server.'
              : 'Keine Verbindung. Der Bericht wird automatisch gesendet, sobald das Tablet wieder online ist.'}
        </p>
        <div className="sent__actions">
          <Link to="/" className="home-link sent__home">
            ‹ Start
          </Link>
          <button type="button" className="btn btn--primary sent__new" onClick={startNewReport}>
            Neuer Bericht
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="inventory">
      <button type="button" className="home-link" onClick={() => navigate('/')}>
        ‹ Start
      </button>
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
          {offline && <span className="inventory__offline">Offline</span>}
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

      {!loading && !error && isMonday && <IfcoSection value={ifco} onChange={setIfco} />}

      {!loading && !error && (
        <section className="form-section" aria-label="Infos für HQ">
          <label className="form-section__title" htmlFor="hq-notes">
            Infos für HQ
          </label>
          <textarea
            id="hq-notes"
            className="hq-notes"
            value={hqNotes}
            onChange={(e) => setHqNotes(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </section>
      )}

      {!loading && !error && (
        <button
          type="button"
          className="btn btn--primary inventory__submit"
          onClick={() => {
            setSendError(null)
            setDialog('review')
          }}
        >
          Prüfen & senden
        </button>
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
      {dialog === 'review' && (
        <ReviewDialog
          report={buildReport()}
          sending={sending}
          error={sendError}
          onSend={send}
          onClose={() => setDialog('none')}
        />
      )}
    </div>
  )
}
