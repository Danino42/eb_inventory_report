// A night shift starts after midnight (01:00–06:30), so the report belongs to the calendar day
// it is filled in on: the Sunday→Monday shift reports "Montag". If the form is opened in the
// evening before, it already counts as the next morning's report.
const EVENING_HOUR = 18

/** Report date as YYYY-MM-DD (local time) */
export function defaultReportDate(now = new Date()): string {
  const d = new Date(now)
  if (d.getHours() >= EVENING_HOUR) d.setDate(d.getDate() + 1)
  return toIsoDate(d)
}

export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" -> local Date at midnight (not UTC, which could shift the day) */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const WEEKDAY = new Intl.DateTimeFormat('de-CH', { weekday: 'long' })
const DATE = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })

/** e.g. { weekday: "Montag", date: "2. November 2026" } */
export function formatReportDate(iso: string) {
  const d = fromIsoDate(iso)
  return { weekday: WEEKDAY.format(d), date: DATE.format(d) }
}
