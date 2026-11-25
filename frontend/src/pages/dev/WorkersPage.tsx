import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { addWorker, listWorkers, removeWorker, renameWorker } from '../../api/workers'
import { AdminTabs } from '../../components/AdminTabs'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useAdminText } from '../../i18n/adminText'
import './FruitsDevPage.css'
import './WorkersPage.css'

/** Verwaltung: the names offered in the worker form's name picker */
export function WorkersPage() {
  const { t } = useAdminText()
  const [names, setNames] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  // The name being renamed and the text typed for it
  const [editing, setEditing] = useState<{ name: string; text: string } | null>(null)
  // Bumped after a change to fetch the list again
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let stale = false
    listWorkers()
      .then((list) => {
        if (!stale) setNames(list)
      })
      .catch((e: unknown) => {
        if (!stale) setError(e instanceof ApiError ? e.message : 'offline')
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

  /** Runs a change; true if it worked. name: the name the error message is about */
  async function change(action: () => Promise<unknown>, message: string, name: string): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await action()
      setNotice(message)
      setReloadKey((k) => k + 1)
      return true
    } catch (e) {
      if (!(e instanceof ApiError)) setError(t.nothingSaved)
      else if (e.status === 409) setError(t.nameTaken(name))
      else if (e.status === 422) setError(t.nameInvalid)
      else setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (name && (await change(() => addWorker(name), t.added(name), name))) setNewName('')
  }

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const text = editing.text.trim()
    if (!text || text === editing.name) return setEditing(null)
    if (await change(() => renameWorker(editing.name, text), t.saved(text), text)) setEditing(null)
  }

  function remove(name: string) {
    if (window.confirm(t.confirmRemoveWorker(name))) void change(() => removeWorker(name), t.deleted(name), name)
  }

  return (
    <div className="dev-page">
      <Link to="/" className="home-link">
        ‹ Start
      </Link>
      <AdminTabs />
      <header className="dev-page__header">
        <h1>
          {t.workersTitle} {names && <span className="muted">· {t.namesCount(names.length)}</span>}
        </h1>
        <div className="dev-page__actions">
          <LanguageToggle />
        </div>
      </header>

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
      {!names && !error && <p className="muted">{t.loading}</p>}

      {names && (
        <section className="workers" aria-label={t.workersTitle}>
          <form className="workers__add" onSubmit={add}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.newName}
              aria-label={t.newName}
              maxLength={60}
              autoComplete="off"
            />
            <button type="submit" className="btn btn--primary" disabled={busy || !newName.trim()}>
              {t.add}
            </button>
          </form>
          <ul className="workers__list">
            {names.map((name) => (
              <li key={name} className="workers__row">
                {editing?.name === name ? (
                  <form className="workers__edit" onSubmit={rename}>
                    <input
                      value={editing.text}
                      onChange={(e) => setEditing({ name, text: e.target.value })}
                      aria-label={t.rename}
                      maxLength={60}
                      autoComplete="off"
                      autoFocus
                    />
                    <button type="submit" className="btn btn--primary" disabled={busy}>
                      {t.save}
                    </button>
                    <button type="button" className="btn" onClick={() => setEditing(null)} disabled={busy}>
                      {t.cancel}
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="workers__name">{name}</span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditing({ name, text: name })}
                      disabled={busy}
                    >
                      {t.rename}
                    </button>
                    <button type="button" className="btn btn--danger" onClick={() => remove(name)} disabled={busy}>
                      {t.remove}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
