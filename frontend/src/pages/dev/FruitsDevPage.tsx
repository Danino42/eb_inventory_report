import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import { listFruits } from '../../api/fruits'
import { FruitIcon } from '../../components/FruitIcon'
import { MonthInitials, MonthStrip } from '../../components/MonthStrip'
import { ThemeToggle } from '../../components/ThemeToggle'
import {
  BOX_LABELS,
  BOX_TYPES,
  CATEGORIES,
  CATEGORY_LABELS,
  MONTHS_EN_LONG,
  UNITS,
  UNIT_LABELS,
  VARIANT_LABELS,
  type BoxType,
  type Category,
  type FruitFilters,
  type FruitWithDerived,
  type Unit,
} from '../../types/fruit'
import { FruitEditor } from './FruitEditor'
import { nextSort, sortFruits, type Sort, type SortKey } from './sortFruits'
import './FruitsDevPage.css'

const CURRENT_MONTH = new Date().getMonth() + 1
const OFFLINE_MESSAGE = "Can't connect to the server. Check the connection and try again."

/** Editor state: closed, creating a new fruit, or editing an existing one */
type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; fruit: FruitWithDerived }

/** Simple = name + months for everyday use; detailed = all data and all filters */
type View = 'simple' | 'detailed'
const VIEW_STORAGE_KEY = 'eb-fruits-view'

function getStoredView(): View {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'detailed' ? 'detailed' : 'simple'
  } catch {
    return 'simple'
  }
}

const COLUMNS: Record<View, { key: SortKey; label: string }[]> = {
  simple: [
    { key: 'name_de', label: 'Fruit' },
    { key: 'months', label: 'Months' },
  ],
  detailed: [
    { key: 'dev_name', label: 'Dev name' },
    { key: 'article_number', label: 'Art.-Nr.' },
    { key: 'name_de', label: 'Deutsch' },
    { key: 'name_en', label: 'English' },
    { key: 'unit', label: 'Unit' },
    ...BOX_TYPES.map((b) => ({ key: b, label: BOX_LABELS[b] })),
  ],
}

export function FruitsDevPage() {
  const [view, setView] = useState<View>(getStoredView)
  const [filters, setFilters] = useState<FruitFilters>({})
  const [fruits, setFruits] = useState<FruitWithDerived[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' })
  const [sort, setSort] = useState<Sort | null>(null)
  // Short confirmation after saving or deleting, e.g. "Kiwi saved"
  const [notice, setNotice] = useState<string | null>(null)
  // Bumped after a save/delete to fetch the list again
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // Ignore responses that arrive after the filters changed again (e.g. fast typing)
    let stale = false
    listFruits(filters)
      .then((data) => {
        if (stale) return
        setFruits(data)
        setError(null)
      })
      .catch((e: unknown) => {
        if (stale) return
        setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE)
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [filters, reloadKey])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const sortedFruits = useMemo(() => sortFruits(fruits, sort), [fruits, sort])
  const columns = COLUMNS[view]
  const highlight = filters.month ?? CURRENT_MONTH

  function setFilter<K extends keyof FruitFilters>(key: K, value: FruitFilters[K] | '') {
    setFilters((f) => ({ ...f, [key]: value === '' ? undefined : value }))
  }

  function switchView() {
    const next: View = view === 'simple' ? 'detailed' : 'simple'
    setView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // Not remembered if storage is blocked; the view still switches
    }
    if (next === 'simple') {
      // The simple view has no box/category/unit filters, so they must not stay active unseen
      setFilters(({ month, q }) => ({ month, q }))
    }
    // Keep the sort only if that column exists in the other view
    setSort((s) => (s && COLUMNS[next].some((c) => c.key === s.key) ? s : null))
  }

  return (
    <div className="dev-page">
      <header className="dev-page__header">
        <h1>
          Fruit catalogue <span className="muted">· dev</span>
        </h1>
        <div className="dev-page__actions">
          <button className="btn" onClick={switchView} aria-pressed={view === 'detailed'}>
            {view === 'simple' ? 'Detailed view' : 'Simple view'}
          </button>
          <ThemeToggle />
          <button className="btn btn--primary" onClick={() => setEditing({ mode: 'new' })}>
            Add fruit
          </button>
        </div>
      </header>

      <section className="filters" aria-label="Filters">
        <label>
          Month
          <span className="filters__month">
            <select
              value={filters.month ?? ''}
              onChange={(e) => setFilter('month', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All months</option>
              {MONTHS_EN_LONG.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <button className="btn btn--small" onClick={() => setFilter('month', CURRENT_MONTH)}>
              This month
            </button>
          </span>
        </label>
        {view === 'detailed' && (
          <>
            <label>
              Box type
              <select
                value={filters.box_type ?? ''}
                onChange={(e) => setFilter('box_type', e.target.value as BoxType)}
              >
                <option value="">All boxes</option>
                {BOX_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BOX_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={filters.category ?? ''}
                onChange={(e) => setFilter('category', e.target.value as Category)}
              >
                <option value="">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit
              <select value={filters.unit ?? ''} onChange={(e) => setFilter('unit', e.target.value as Unit)}>
                <option value="">All</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="filters__search">
          Search
          <input
            type="search"
            placeholder="Fruit name"
            value={filters.q ?? ''}
            onChange={(e) => setFilter('q', e.target.value)}
          />
        </label>
        <button className="btn btn--ghost" onClick={() => setFilters({})}>
          Clear filters
        </button>
      </section>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section aria-label="Fruit table">
        <h2 className="table-count">
          {loading
            ? 'Loading…'
            : `${fruits.length} fruits${filters.month ? ` available in ${MONTHS_EN_LONG[filters.month - 1]}` : ''}`}
        </h2>
        <div className="table-wrap">
          <table className={`fruit-table fruit-table--${view}`}>
            {view === 'simple' && (
              // Fruit and Months share the width evenly; Edit stays narrow
              <colgroup>
                <col className="fruit-table__col-half" />
                <col className="fruit-table__col-half" />
                <col className="fruit-table__col-action" />
              </colgroup>
            )}
            <thead>
              <tr>
                {columns.map((col) => {
                  const active = sort?.key === col.key ? sort.direction : null
                  return (
                    <th
                      key={col.key}
                      aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}
                    >
                      <button
                        type="button"
                        className={`sort-button${active ? ' is-active' : ''}`}
                        onClick={() => setSort((s) => nextSort(s, col.key))}
                      >
                        {col.label}
                        <span className="sort-button__icon" aria-hidden="true">
                          {active === 'asc' ? '▲' : active === 'desc' ? '▼' : '↕'}
                        </span>
                      </button>
                      {view === 'simple' && col.key === 'months' && (
                        <span className="fruit-table__initials">
                          <MonthInitials highlight={highlight} />
                        </span>
                      )}
                    </th>
                  )
                })}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sortedFruits.map((f) => (
                <tr key={f.dev_name} onClick={() => setEditing({ mode: 'edit', fruit: f })}>
                  {view === 'simple' ? (
                    <>
                      <td className="fruit-table__name">
                        <span className="fruit-name">
                          <FruitIcon devName={f.dev_name} size={36} />
                          <span>
                            {f.name_de}
                            {f.note && <small className="note">{f.note}</small>}
                          </span>
                        </span>
                      </td>
                      <td>
                        <MonthStrip months={f.months} highlight={highlight} size="wide" />
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <code>{f.dev_name}</code>
                      </td>
                      <td>{f.article_number}</td>
                      <td className="fruit-table__name">
                        <span className="fruit-name">
                          <FruitIcon devName={f.dev_name} size={28} />
                          <span>
                            {f.name_de}
                            {f.note && <small className="note">{f.note}</small>}
                          </span>
                        </span>
                      </td>
                      <td>{f.name_en}</td>
                      <td>
                        {f.unit}
                        <small className="note">{f.variants.map((v) => VARIANT_LABELS[v]).join(' · ')}</small>
                      </td>
                      {BOX_TYPES.map((b) => {
                        const a = f.availability[b]
                        return (
                          <td key={b} className="fruit-table__box">
                            {a ? (
                              <>
                                <MonthStrip months={a.months} highlight={highlight} />
                                {a.category === 'addon' && <span className="addon-mark">add-on</span>}
                              </>
                            ) : (
                              <span className="muted">–</span>
                            )}
                          </td>
                        )
                      })}
                    </>
                  )}
                  <td className="fruit-table__action">
                    <button className="link-button" onClick={() => setEditing({ mode: 'edit', fruit: f })}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing.mode !== 'closed' && (
        <FruitEditor
          fruit={editing.mode === 'edit' ? editing.fruit : null}
          onClose={() => setEditing({ mode: 'closed' })}
          onSaved={(message) => {
            setEditing({ mode: 'closed' })
            setNotice(message)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
