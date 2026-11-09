import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { listFruits } from '../../api/fruits'
import { AdminTabs } from '../../components/AdminTabs'
import { LanguageToggle } from '../../components/LanguageToggle'
import { FruitIcon } from '../../components/FruitIcon'
import { MonthInitials, MonthStrip } from '../../components/MonthStrip'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAdminText, type AdminText, type Lang } from '../../i18n/adminText'
import {
  BOX_LABELS,
  BOX_TYPES,
  CATEGORIES,
  UNITS,
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

/** Table columns per view; the simple view shows (and sorts by) the name in the chosen language */
function columnsFor(view: View, t: AdminText, lang: Lang): { key: SortKey; label: string }[] {
  if (view === 'simple') {
    return [
      { key: lang === 'de' ? 'name_de' : 'name_en', label: t.colFruit },
      { key: 'months', label: t.colMonths },
    ]
  }
  return [
    { key: 'dev_name', label: t.colDevName },
    { key: 'article_number', label: t.colArticleNumber },
    { key: 'name_de', label: t.colGerman },
    { key: 'name_en', label: t.colEnglish },
    { key: 'unit', label: t.unit },
    ...BOX_TYPES.map((b) => ({ key: b as SortKey, label: BOX_LABELS[b] })),
  ]
}

export function FruitsDevPage() {
  const { t, lang } = useAdminText()
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
        setError(e instanceof ApiError ? e.message : 'offline')
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
  const columns = columnsFor(view, t, lang)
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
    setSort((s) => (s && columnsFor(next, t, lang).some((c) => c.key === s.key) ? s : null))
  }

  return (
    <div className="dev-page">
      <Link to="/" className="home-link">
        ‹ Start
      </Link>
      <AdminTabs />
      <header className="dev-page__header">
        <h1>{t.fruitsTitle}</h1>
        <div className="dev-page__actions">
          <button className="btn" onClick={switchView} aria-pressed={view === 'detailed'}>
            {view === 'simple' ? t.detailedView : t.simpleView}
          </button>
          <LanguageToggle />
          <ThemeToggle />
          <button className="btn btn--primary" onClick={() => setEditing({ mode: 'new' })}>
            {t.addFruit}
          </button>
        </div>
      </header>

      <section className="filters" aria-label={t.search}>
        <label>
          {t.month}
          <span className="filters__month">
            <select
              value={filters.month ?? ''}
              onChange={(e) => setFilter('month', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{t.allMonths}</option>
              {t.monthsLong.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <button className="btn btn--small" onClick={() => setFilter('month', CURRENT_MONTH)}>
              {t.thisMonth}
            </button>
          </span>
        </label>
        {view === 'detailed' && (
          <>
            <label>
              {t.boxType}
              <select
                value={filters.box_type ?? ''}
                onChange={(e) => setFilter('box_type', e.target.value as BoxType)}
              >
                <option value="">{t.allBoxes}</option>
                {BOX_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BOX_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.category}
              <select
                value={filters.category ?? ''}
                onChange={(e) => setFilter('category', e.target.value as Category)}
              >
                <option value="">{t.all}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t.categories[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.unit}
              <select value={filters.unit ?? ''} onChange={(e) => setFilter('unit', e.target.value as Unit)}>
                <option value="">{t.all}</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t.units[u]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="filters__search">
          {t.search}
          <input
            type="search"
            placeholder={t.fruitNamePlaceholder}
            value={filters.q ?? ''}
            onChange={(e) => setFilter('q', e.target.value)}
          />
        </label>
        <button className="btn btn--ghost" onClick={() => setFilters({})}>
          {t.clearFilters}
        </button>
      </section>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error === 'offline' ? t.offline : error}
        </p>
      )}

      <section aria-label={t.fruitsTitle}>
        <h2 className="table-count">
          {loading
            ? t.loading
            : t.fruitsCount(fruits.length, filters.month ? t.monthsLong[filters.month - 1] : undefined)}
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
                <th aria-label={t.edit} />
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
                            {lang === 'de' ? f.name_de : f.name_en}
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
                        <small className="note">{f.variants.map((v) => t.variants[v]).join(' · ')}</small>
                      </td>
                      {BOX_TYPES.map((b) => {
                        const a = f.availability[b]
                        return (
                          <td key={b} className="fruit-table__box">
                            {a ? (
                              <>
                                <MonthStrip months={a.months} highlight={highlight} />
                                {a.category === 'addon' && <span className="addon-mark">{t.addonMark}</span>}
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
                      {t.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {/* +1 for the Edit column */}
                <td colSpan={columns.length + 1} className="fruit-table__add">
                  <button type="button" onClick={() => setEditing({ mode: 'new' })}>
                    + {t.addFruit}
                  </button>
                </td>
              </tr>
            </tfoot>
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
