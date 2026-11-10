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
  /** Adds this many kg (one crate) to the amount */
  onAddCrate: (kg: number) => void
  /** Only for fruits added by hand for this report */
  onRemove?: () => void
  /** In the Add-ons part the variant is not given by the title, so the row shows it */
  showVariant: boolean
}

/** One amount field. For kg fruits the fruit itself (icon + name) is a button: one tap = one crate */
export function StockRow({ fruit, variant, value, onChange, onStep, onAddCrate, onRemove, showVariant }: Props) {
  const perCrate = crateKg(fruit)
  const amount = parseAmount(value)
  const info = (
    <>
      <FruitIcon devName={fruit.dev_name} size={44} />
      <span className="stock__label">
        <span className="stock__name">{fruit.name_de}</span>
        <span className="stock__meta">
          {fruit.article_number || 'Eigene Eingabe'}
          {showVariant && ` · ${VARIANT_SHORT[variant]}`}
        </span>
      </span>
    </>
  )

  return (
    <li className="stock__row">
      {perCrate ? (
        <button type="button" className="stock__fruit" onClick={() => onAddCrate(perCrate)}>
          {info}
          {amount ? <span className="stock__crates">{formatCrates(amount, perCrate)}</span> : null}
        </button>
      ) : (
        <div className="stock__fruit">{info}</div>
      )}
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
