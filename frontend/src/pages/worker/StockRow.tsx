import { FruitIcon } from '../../components/FruitIcon'
import { VARIANT_LABELS, VARIANT_SHORT, type FruitWithDerived, type Variant } from '../../types/fruit'
import { crateKg, formatCrates, parseAmount, type StepDelta } from './amount'
import { QuantityInput } from './QuantityInput'

interface Props {
  fruit: FruitWithDerived
  variant: Variant
  value: string
  onChange: (value: string) => void
  onStep: (delta: StepDelta) => void
  /** Adds to the amount: one crate (Hauptfrüchte) or one piece (add-ons) */
  onAdd: (delta: number) => void
  /** Only for fruits added by hand for this report */
  onRemove?: () => void
  /** Row in the Add-ons part: tapping adds 1, and the variant is shown (not given by the title) */
  addon: boolean
}

/** One amount field. The fruit itself (icon + name) is a button: Hauptfrüchte add a whole crate
    per tap, add-ons one piece */
export function StockRow({ fruit, variant, value, onChange, onStep, onAdd, onRemove, addon }: Props) {
  const perCrate = addon ? null : crateKg(fruit)
  const amount = parseAmount(value)

  return (
    <li className="stock__row">
      <button type="button" className="stock__fruit" onClick={() => onAdd(perCrate ?? 1)}>
        <FruitIcon devName={fruit.dev_name} size={44} />
        <span className="stock__label">
          <span className="stock__name">{fruit.name_de}</span>
          <span className="stock__meta">
            {fruit.article_number || 'Eigene Eingabe'}
            {addon && ` · ${VARIANT_SHORT[variant]}`}
          </span>
        </span>
        {perCrate && amount ? <span className="stock__crates">{formatCrates(amount, perCrate)}</span> : null}
      </button>
      <div className="stock__amount">
        <QuantityInput
          value={value}
          unit={fruit.unit}
          onChange={onChange}
          onStep={onStep}
          label={`${fruit.name_de} ${VARIANT_LABELS[variant]}`}
        />
        {onRemove && (
          <button type="button" className="link-button stock__remove" onClick={onRemove}>
            Entfernen
          </button>
        )}
      </div>
    </li>
  )
}
