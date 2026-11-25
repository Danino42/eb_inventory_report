import { FruitIcon } from '../../components/FruitIcon'
import { VARIANTS, VARIANT_LABELS } from '../../types/fruit'
import { addAmount } from './amount'
import type { BananaReturns } from './bananaReturns'
import { QuantityInput } from './QuantityInput'

interface Props {
  value: BananaReturns
  /** Gets an updater, so quick repeated taps on − / + all count */
  onChange: (update: (current: BananaReturns) => BananaReturns) => void
}

/** Daily section before IFCO: Konventionell and Bio (side by side on wide screens) */
export function BananaReturnsSection({ value, onChange }: Props) {
  return (
    <section className="form-section" aria-label="Bananen Retouren">
      <h2 className="form-section__title">
        <FruitIcon devName="banana" size={44} />
        Bananen Retouren
      </h2>
      <div className="banana-returns">
        {VARIANTS.map((v) => (
          <div key={v} className="banana-returns__field">
            <span className="form-field__label">{VARIANT_LABELS[v]}</span>
            <QuantityInput
              value={value[v]}
              unit="kg"
              onChange={(text) => onChange((r) => ({ ...r, [v]: text }))}
              onStep={(delta) => onChange((r) => ({ ...r, [v]: addAmount(r[v], delta) }))}
              label={`Bananen Retouren ${VARIANT_LABELS[v]}`}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
