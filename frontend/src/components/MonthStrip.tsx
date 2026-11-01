import { MONTHS_EN } from '../types/fruit'
import './MonthStrip.css'

interface Props {
  months: number[]
  /** Month to outline, e.g. the month currently filtered for */
  highlight?: number
  /** "wide" stretches the cells to fill the column (simple view) */
  size?: 'compact' | 'wide'
}

/** 12-cell calendar row: filled cells are available months */
export function MonthStrip({ months, highlight, size = 'compact' }: Props) {
  const label = months.length ? months.map((m) => MONTHS_EN[m - 1]).join(', ') : 'not available'
  return (
    <span className={`month-strip month-strip--${size}`} role="img" aria-label={label} title={label}>
      {MONTHS_EN.map((name, i) => {
        const month = i + 1
        const classes = ['month-strip__cell']
        if (months.includes(month)) classes.push('is-on')
        if (month === highlight) classes.push('is-highlight')
        return <span key={name} className={classes.join(' ')} />
      })}
    </span>
  )
}

/** Month initials (J F M …) laid out on the same grid as a wide MonthStrip */
export function MonthInitials({ highlight }: { highlight?: number }) {
  return (
    <span className="month-strip month-strip--wide month-initials" aria-hidden="true">
      {MONTHS_EN.map((name, i) => (
        <span key={name} className={i + 1 === highlight ? 'is-highlight' : undefined}>
          {name[0]}
        </span>
      ))}
    </span>
  )
}
