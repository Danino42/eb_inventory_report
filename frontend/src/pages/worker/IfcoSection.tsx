import ifcoIcon from '../../images/ifco.png'
import { stepAmount } from './amount'
import type { IfcoState } from './ifco'
import { QuantityInput } from './QuantityInput'

interface Props {
  value: IfcoState
  /** Gets an updater, so quick repeated taps on − / + all count */
  onChange: (update: (current: IfcoState) => IfcoState) => void
}

export function IfcoSection({ value, onChange }: Props) {
  return (
    <section className="form-section" aria-label="IFCO">
      <h2 className="form-section__title">
        <img src={ifcoIcon} alt="" width={44} height={44} />
        IFCO
      </h2>

      <div className="form-field">
        <span className="form-field__label">IFCOs zurück erhalten</span>
        <QuantityInput
          value={value.returned}
          unit="pcs"
          onChange={(returned) => onChange((s) => ({ ...s, returned }))}
          onStep={(delta) => onChange((s) => ({ ...s, returned: stepAmount(s.returned, delta) }))}
          label="IFCOs zurück erhalten"
        />
      </div>

      <div className="form-field">
        <span className="form-field__label">
          Genügend saubere IFCOs vorhanden
          <small className="muted">mind. 1 Stoss gross und 2 Stoss klein</small>
        </span>
        <div className="choice" role="radiogroup" aria-label="Genügend saubere IFCOs vorhanden">
          {([true, false] as const).map((answer) => (
            <button
              key={String(answer)}
              type="button"
              role="radio"
              aria-checked={value.enoughClean === answer}
              className={value.enoughClean === answer ? 'is-active' : ''}
              onClick={() => onChange((s) => ({ ...s, enoughClean: answer }))}
            >
              {answer ? 'Ja' : 'Nein'}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <span className="form-field__label">Nachbestellen</span>
        <div className="choice" role="group" aria-label="IFCO nachbestellen">
          {(
            [
              ['reorderSmall', 'IFCO klein'],
              ['reorderLarge', 'IFCO gross'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={value[key]}
              className={value[key] ? 'is-active' : ''}
              onClick={() => onChange((s) => ({ ...s, [key]: !s[key] }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
