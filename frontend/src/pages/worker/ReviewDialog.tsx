import { useEffect, useRef, useState } from 'react'
import { getDeliveryInfo, type DeliveryInfo, type InventoryReport, type StockLine } from '../../api/reports'
import { readJson, writeJson } from '../../lib/storage'
import { FruitIcon } from '../../components/FruitIcon'
import ifcoIcon from '../../images/ifco.png'
import { VARIANT_LABELS, type Variant } from '../../types/fruit'
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

/** One-screen overview before sending; empty fields in a soft orange */
export function ReviewDialog({ report, sending, error, onSend, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
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

        <ul className="review__grid">
          {byFruit(report.lines).map((lines) => (
            <li key={lines[0].dev_name} className="review__fruit">
              <span className="review__name">
                <FruitIcon devName={lines[0].dev_name} size={26} />
                <span>{lines[0].name_de}</span>
              </span>
              <span className="review__values">
                {lines.map((l) => (
                  <span
                    key={l.variant}
                    className={`review__value${l.quantity === null ? ' is-empty' : ''}`}
                    title={VARIANT_LABELS[l.variant]}
                  >
                    <small>{SHORT[l.variant]}</small>
                    {l.quantity === null ? 'leer' : `${formatAmount(l.quantity)} ${UNIT_SHORT[l.unit]}`}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>

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
            disabled={sending || !report.worker}
          >
            {sending ? 'Wird gesendet…' : 'An HQ senden'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
