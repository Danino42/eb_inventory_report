import type { Unit } from '../../types/fruit'
import { KG_WARNING_LIMIT, UNIT_SHORT, isAllowedInput, parseAmount } from './amount'

interface Props {
  value: string
  unit: Unit
  onChange: (value: string) => void
  /** − / + : the parent applies it to the latest value, so quick repeated taps all count */
  onStep: (delta: 1 | -1) => void
  /** Accessible name, e.g. "Apfel Gala Bio" */
  label: string
}

/** − [ 12 kg ] + : number keypad on tap, ±1 buttons, warning above 50 kg, never negative */
export function QuantityInput({ value, unit, onChange, onStep, label }: Props) {
  const amount = parseAmount(value)
  const warn = unit === 'kg' && amount !== null && amount > KG_WARNING_LIMIT

  return (
    <div className={`qty${warn ? ' qty--warn' : ''}`}>
      <div className="qty__row">
        <button
          type="button"
          className="qty__step"
          onClick={() => onStep(-1)}
          disabled={amount === null || amount <= 0}
          aria-label={`${label}: eins weniger`}
        >
          −
        </button>
        <label className="qty__field">
          <input
            value={value}
            onChange={(e) => {
              if (isAllowedInput(e.target.value, unit)) onChange(e.target.value)
            }}
            inputMode={unit === 'pcs' ? 'numeric' : 'decimal'}
            enterKeyHint="next"
            autoComplete="off"
            aria-label={label}
          />
          <span className="qty__unit">{UNIT_SHORT[unit]}</span>
        </label>
        <button
          type="button"
          className="qty__step"
          onClick={() => onStep(1)}
          aria-label={`${label}: eins mehr`}
        >
          +
        </button>
      </div>
      {warn && (
        <p className="qty__warning" role="status">
          Bist du sicher?
        </p>
      )}
    </div>
  )
}
