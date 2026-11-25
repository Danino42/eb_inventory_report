import { FruitIcon } from '../../components/FruitIcon'
import { VARIANTS, VARIANT_LABELS } from '../../types/fruit'
import { addAmount, formatCrates, parseAmount } from './amount'
import type { BananaReturns } from './bananaReturns'
import { QuantityInput } from './QuantityInput'

interface Props {
  value: BananaReturns
  /** kg in one crate: the Banane's "Inhalt (pro Kiste)" in the catalogue */
  perCrate: number
  /** Gets an updater, so quick repeated taps on − / + all count */
  onChange: (update: (current: BananaReturns) => BananaReturns) => void
}

/** Daily section before IFCO: Konventionell and Bio (side by side on wide screens) */
export function BananaReturnsSection({ value, perCrate, onChange }: Props) {
  return (
    <section className="form-section" aria-label="Bananen Retouren">
      <h2 className="form-section__title">
        <FruitIcon devName="banana" size={44} />
        Bananen Retouren
      </h2>
      <div className="banana-returns">
        {VARIANTS.map((v) => {
          const amount = parseAmount(value[v])
          const add = (delta: number) => onChange((r) => ({ ...r, [v]: addAmount(r[v], delta) }))
          return (
            <div key={v} className="banana-returns__field">
              {/* Like the fruits above: each tap adds one crate */}
              <button type="button" className="stock__fruit banana-returns__fruit" onClick={() => add(perCrate)}>
                <span className="stock__label">
                  <span className="stock__name">{VARIANT_LABELS[v]}</span>
                  {perCrate !== 1 && amount ? (
                    <span className="stock__meta">{formatCrates(amount, perCrate)}</span>
                  ) : null}
                </span>
              </button>
              <QuantityInput
                value={value[v]}
                unit="kg"
                onChange={(text) => onChange((r) => ({ ...r, [v]: text }))}
                onStep={add}
                label={`Bananen Retouren ${VARIANT_LABELS[v]}`}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
