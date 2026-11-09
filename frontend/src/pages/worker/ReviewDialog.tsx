import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDeliveryInfo, type DeliveryInfo, type InventoryReport, type StockLine } from '../../api/reports'
import { readJson, writeJson } from '../../lib/storage'
import { FruitIcon } from '../../components/FruitIcon'
import ifcoIcon from '../../images/ifco.png'
import { VARIANTS, VARIANT_LABELS, type Variant } from '../../types/fruit'
import { UNIT_SHORT, formatAmount } from './amount'
import { formatReportDate } from './reportDate'

interface Props {
  report: InventoryReport
  sending: boolean
  error: string | null
  onSend: () => void
  onClose: () => void
}

const SHORT: Record<Variant, string> = { conventional: 'Konv.', bio: 'Bio' }

// Last known recipients, so the line is also shown when the tablet is offline
const DELIVERY_KEY = 'eb-delivery-info-v1'

/** Lines grouped per fruit, in form order */
function byFruit(lines: StockLine[]) {
  const groups = new Map<string, StockLine[]>()
  for (const line of lines) groups.set(line.dev_name, [...(groups.get(line.dev_name) ?? []), line])
  return [...groups.values()]
}

// How many fruit columns fit side by side. Tuned so that even a summer list (~25 fruits)
// fits on one screen of the 8" Galaxy Tab Active5 (about 960x600) as well as on 10" tablets.
function columnCount(): number {
  if (window.innerWidth >= 900) return 3
  if (window.innerWidth >= 520) return 2
  return 1
}

function subscribeResize(listener: () => void) {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

/** Splits the fruits into columns that read top to bottom, like the paper form */
function toColumns<T>(items: T[], columns: number): T[][] {
  const perColumn = Math.max(1, Math.ceil(items.length / columns))
  const result: T[][] = []
  for (let i = 0; i < items.length; i += perColumn) result.push(items.slice(i, i + perColumn))
  return result
}

/** One-screen overview before sending; empty fields in a soft orange */
export function ReviewDialog({ report, sending, error, onSend, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const columns = useSyncExternalStore(subscribeResize, columnCount)
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(() => readJson(DELIVERY_KEY, null))

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    getDeliveryInfo()
      .then((info) => {
        setDelivery(info)
        writeJson(DELIVERY_KEY, info)
      })
      .catch(() => {
        // Offline: keep showing the last known recipients
      })
  }, [])

  const { weekday, date } = formatReportDate(report.report_date)
  const empty = report.lines.filter((l) => l.quantity === null).length
  const ifco = report.ifco
  const reorder = ifco
    ? [ifco.reorder_small && 'klein', ifco.reorder_large && 'gross'].filter(Boolean).join(' und ')
    : ''

  return (
    <dialog ref={dialogRef} className="sheet review" onClose={onClose}>
      <div className="sheet__body review__body">
        <header className="review__header">
          <div>
            <h2>
              {weekday} {date}
            </h2>
            <p className={report.worker ? 'review__worker' : 'review__worker is-missing'}>
              {report.worker || 'Name fehlt'}
            </p>
          </div>
          <p className={`review__count${empty ? ' is-empty' : ''}`}>
            {empty ? `${empty} von ${report.lines.length} Feldern leer` : 'Alle Felder ausgefüllt'}
          </p>
        </header>

        <div className="review__columns" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {toColumns(byFruit(report.lines), columns).map((column, i) => (
            <table key={i} className="review__table">
              <thead>
                <tr>
                  <th>Frucht</th>
                  {VARIANTS.map((v) => (
                    <th key={v} className="review__num" title={VARIANT_LABELS[v]}>
                      {SHORT[v]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {column.map((lines) => (
                  <tr key={lines[0].dev_name}>
                    <td>
                      <span className="review__name">
                        <FruitIcon devName={lines[0].dev_name} size={22} />
                        <span>{lines[0].name_de}</span>
                      </span>
                    </td>
                    {VARIANTS.map((v) => {
                      const line = lines.find((l) => l.variant === v)
                      if (!line) {
                        // This fruit is not stocked in this variant (e.g. lemons: Bio only)
                        return (
                          <td key={v} className="review__num review__na">
                            –
                          </td>
                        )
                      }
                      return (
                        <td key={v} className="review__num">
                          <span className={`review__value${line.quantity === null ? ' is-empty' : ''}`}>
                            {line.quantity === null ? 'leer' : `${formatAmount(line.quantity)} ${UNIT_SHORT[line.unit]}`}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        {ifco && (
          <p className="review__line">
            <strong className="review__label">
              <img src={ifcoIcon} alt="" width={26} height={26} />
              IFCO
            </strong>
            <span className={ifco.returned === null ? 'is-empty' : ''}>
              {ifco.returned === null ? 'zurück: leer' : `${ifco.returned} zurück`}
            </span>
            <span className={ifco.enough_clean === null ? 'is-empty' : ''}>
              genügend sauber: {ifco.enough_clean === null ? 'leer' : ifco.enough_clean ? 'Ja' : 'Nein'}
            </span>
            <span>nachbestellen: {reorder || 'nichts'}</span>
          </p>
        )}
        {report.hq_notes.trim() && (
          <p className="review__line">
            <strong>Infos für HQ</strong>
            <span className="review__notes">{report.hq_notes.trim()}</span>
          </p>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {delivery && (
          <p className="review__recipient">
            {delivery.email_enabled ? (
              <>
                <span className="muted">An</span> <strong>{delivery.recipients.join(', ')}</strong>
              </>
            ) : (
              <span className="muted">E-Mail-Versand nicht eingerichtet, der Bericht wird auf dem Server gespeichert</span>
            )}
          </p>
        )}

        <footer className="review__footer">
          <button type="button" className="btn review__back" onClick={onClose} disabled={sending}>
            Zurück
          </button>
          <button
            type="button"
            className="btn btn--primary review__send"
            onClick={onSend}
            disabled={sending}
          >
            {sending ? 'Wird gesendet…' : 'An HQ senden'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
