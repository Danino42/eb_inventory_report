import { FruitIcon } from '../../components/FruitIcon'
import { VARIANT_LABELS, VARIANT_SHORT, type FruitWithDerived, type Variant } from '../../types/fruit'
import { crateContent, formatCrates, parseAmount, type StepDelta } from './amount'
import { QuantityInput } from './QuantityInput'

interface Props {
  fruit: FruitWithDerived
  variant: Variant
  value: string
  onChange: (value: string) => void
  onStep: (delta: StepDelta) => void
  /** Adds one crate: the fruit's "Inhalt (pro Kiste)", 1 until it is set in the Verwaltung */
  onAdd: (delta: number) => void
  /** Only for fruits added by hand for this report */
  onRemove?: () => void
  /** Row in the Add-ons part: the variant is shown (it is not given by the title) */
  addon: boolean
}

/** One amount field. The fruit itself (icon + name) is a button: each tap adds one crate */
export function StockRow({ fruit, variant, value, onChange, onStep, onAdd, onRemove, addon }: Props) {
  const perCrate = crateContent(fruit)
  const amount = parseAmount(value)
  // Typed into the form by hand: one field, not split into Konventionell / Bio
  const custom = fruit.dev_name.startsWith('custom_')
  // Catalogue fruits may simply have no article number yet
  const lead = custom ? 'Eigene Eingabe' : fruit.article_number

  return (
    <li className="stock__row">
      <button type="button" className="stock__fruit" onClick={() => onAdd(perCrate)}>
        <FruitIcon devName={fruit.dev_name} size={44} />
        <span className="stock__label">
          <span className="stock__name">{fruit.name_de}</span>
          <span className="stock__meta">
            {lead}
            {addon && !custom && `${lead ? ' · ' : ''}${VARIANT_SHORT[variant]}`}
          </span>
        </span>
        {/* Crates only mean something if one holds more than a single unit */}
        {perCrate !== 1 && amount ? (
          <span className="stock__crates">{formatCrates(amount, perCrate)}</span>
        ) : null}
      </button>
      <div className="stock__amount">
        <QuantityInput
          value={value}
          unit={fruit.unit}
          onChange={onChange}
          onStep={onStep}
          label={custom ? fruit.name_de : `${fruit.name_de} ${VARIANT_LABELS[variant]}`}
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
