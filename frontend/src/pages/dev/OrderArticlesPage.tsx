import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { listFruits } from '../../api/fruits'
import { listOrderArticles } from '../../api/orderArticles'
import { AdminTabs } from '../../components/AdminTabs'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useAdminText } from '../../i18n/adminText'
import type { FruitWithDerived } from '../../types/fruit'
import type { OrderArticle } from '../../types/orderArticle'
import { OrderArticleEditor } from './OrderArticleEditor'
import './FruitsDevPage.css'
import './OrderArticlesPage.css'


// Swiss number format as on the printed list: 1'234.5
const quantityFormat = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 3 })
const priceFormat = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; article: OrderArticle }

/** Verwaltung tab: the regularly ordered articles, grouped by supplier like the printed list */
export function OrderArticlesPage() {
  const { t } = useAdminText()
  const [articles, setArticles] = useState<OrderArticle[]>([])
  const [fruits, setFruits] = useState<FruitWithDerived[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' })
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let stale = false
    Promise.all([listOrderArticles(), listFruits()])
      .then(([a, f]) => {
        if (stale) return
        setArticles(a)
        setFruits(f)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!stale) setError(e instanceof ApiError ? e.message : 'offline')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [reloadKey])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  // Suppliers in list order (first appearance), like the printed order list
  const suppliers = useMemo(() => [...new Set(articles.map((a) => a.supplier))], [articles])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = articles.filter(
      (a) =>
        (!supplierFilter || a.supplier === supplierFilter) &&
        (!q || a.text.toLowerCase().includes(q) || a.supplier.toLowerCase().includes(q)),
    )
    return suppliers
      .map((supplier) => ({ supplier, items: visible.filter((a) => a.supplier === supplier) }))
      .filter((g) => g.items.length > 0)
  }, [articles, suppliers, supplierFilter, query])

  const shownCount = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="dev-page">
      <Link to="/" className="home-link">
        ‹ Start
      </Link>
      <AdminTabs />
      <header className="dev-page__header">
        <h1>
          {t.ordersTitle} <span className="muted">· {t.demoData}</span>
        </h1>
        <div className="dev-page__actions">
          <LanguageToggle />
          <button className="btn btn--primary" onClick={() => setEditing({ mode: 'new' })}>
            {t.addArticle}
          </button>
        </div>
      </header>

      <section className="filters" aria-label={t.search}>
        <label>
          {t.supplier}
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="">{t.allSuppliers}</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="filters__search">
          {t.search}
          <input type="search" placeholder={t.articlePlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setSupplierFilter('')
            setQuery('')
          }}
        >
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

      <section aria-label={t.ordersTitle}>
        <h2 className="table-count">
          {loading ? t.loading : t.ordersCount(shownCount, groups.length)}
        </h2>
        <div className="table-wrap">
          <table className="fruit-table order-table">
            <thead>
              <tr>
                <th>{t.colArticle}</th>
                <th className="num">{t.colUnitPrice}</th>
                <th className="num">{t.colNeeded}</th>
                <th className="num">{t.colCrates}</th>
                <th className="num">{t.colOrdered}</th>
                <th aria-label={t.edit} />
              </tr>
            </thead>
            {groups.map(({ supplier, items }) => (
              <tbody key={supplier}>
                <tr className="order-table__supplier">
                  <th colSpan={4} scope="rowgroup">
                    {supplier}
                  </th>
                  <td colSpan={2} className="num muted">
                    {t.total(quantityFormat.format(items.reduce((n, a) => n + a.order_quantity, 0)))}
                  </td>
                </tr>
                {items.map((a) => (
                  <tr key={a.id} onClick={() => setEditing({ mode: 'edit', article: a })}>
                    <td className="fruit-table__name">{a.text}</td>
                    <td className="num">CHF {priceFormat.format(a.unit_price)}</td>
                    <td className="num">
                      {quantityFormat.format(a.ek_quantity)} {t.orderUnits[a.unit]}
                    </td>
                    <td className="num">{a.crates ?? ''}</td>
                    <td className={`num${a.order_quantity < a.ek_quantity ? ' order-table__less' : ''}`}>
                      {quantityFormat.format(a.order_quantity)} {t.orderUnits[a.unit]}
                    </td>
                    <td className="fruit-table__action">
                      <button className="link-button" onClick={() => setEditing({ mode: 'edit', article: a })}>
                        {t.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr>
                <td colSpan={6} className="fruit-table__add">
                  <button type="button" onClick={() => setEditing({ mode: 'new' })}>
                    + {t.addArticle}
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {editing.mode !== 'closed' && (
        <OrderArticleEditor
          article={editing.mode === 'edit' ? editing.article : null}
          suppliers={suppliers}
          fruits={fruits}
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
