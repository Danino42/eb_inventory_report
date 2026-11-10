import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { getMailSettings, saveRecipients, sendTestMail, type MailSettingsInfo } from '../../api/settings'
import { AdminTabs } from '../../components/AdminTabs'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useAdminText } from '../../i18n/adminText'
import './FruitsDevPage.css'
import './SettingsPage.css'

const MAX_RECIPIENTS = 10

interface Row {
  id: number
  address: string
}

/** Verwaltung settings: who gets the report emails; the sender is fixed */
export function SettingsPage() {
  const { t } = useAdminText()
  const [info, setInfo] = useState<MailSettingsInfo | null>(null)
  // One field per address (stable ids, so removing a row keeps the others' focus and text)
  const [rows, setRows] = useState<Row[]>([])
  const nextId = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)

  function toRows(addresses: string[]): Row[] {
    const list = addresses.length ? addresses : ['']
    return list.map((address) => ({ id: nextId.current++, address }))
  }

  function show(settings: MailSettingsInfo) {
    setInfo(settings)
    setRows(toRows(settings.recipients))
  }

  useEffect(() => {
    let stale = false
    getMailSettings()
      .then((settings) => {
        if (!stale) show(settings)
      })
      .catch((e: unknown) => {
        if (!stale) setError(e instanceof ApiError ? e.message : 'offline')
      })
    return () => {
      stale = true
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  function setAddress(id: number, address: string) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, address } : r)))
  }

  /** The filled-in addresses; null (with an error shown) if there is none */
  function recipients(): string[] | null {
    const list = rows.map((r) => r.address.trim()).filter(Boolean)
    if (list.length === 0) {
      setError(t.noRecipients)
      return null
    }
    return list
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const list = recipients()
    if (!list) return
    setBusy('save')
    setError(null)
    try {
      show(await saveRecipients(list))
      setNotice(t.settingsSaved)
    } catch (e) {
      if (e instanceof ApiError) setError(e.status === 422 ? t.invalidEmails : e.message)
      else setError(t.nothingSaved)
    } finally {
      setBusy(null)
    }
  }

  /** Sends a test email to the addresses on the page (not saved); a failure shows the reason */
  async function test() {
    const list = recipients()
    if (!list) return
    setBusy('test')
    setError(null)
    try {
      const result = await sendTestMail(list)
      setNotice(t.testSent(result.recipients.join(', ')))
    } catch (e) {
      if (!(e instanceof ApiError)) setError(t.offline)
      else if (e.status === 422) setError(t.invalidEmails)
      else setError(`${t.testFailed} ${e.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dev-page">
      <Link to="/" className="home-link">
        ‹ Start
      </Link>
      <AdminTabs />
      <header className="dev-page__header">
        <h1>{t.settingsTitle}</h1>
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
      {!info && !error && <p className="muted">{t.loading}</p>}

      {info && (
        <form className="settings" onSubmit={save}>
          <h2>{t.reportEmails}</h2>
          <div className="settings__field settings__field--top">
            <span className="settings__label">{t.recipients}</span>
            <div className="settings__list">
              {rows.map((row, i) => (
                <div key={row.id} className="settings__row">
                  <input
                    type="email"
                    value={row.address}
                    onChange={(e) => setAddress(row.id, e.target.value)}
                    aria-label={`${t.recipients} ${i + 1}`}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                    >
                      {t.remove}
                    </button>
                  )}
                </div>
              ))}
              {rows.length < MAX_RECIPIENTS && (
                <button
                  type="button"
                  className="btn settings__add"
                  onClick={() => setRows((list) => [...list, { id: nextId.current++, address: '' }])}
                >
                  + {t.recipient}
                </button>
              )}
            </div>
          </div>
          <label className="settings__field">
            <span className="settings__label">{t.sender}</span>
            <input className="settings__fixed" value={info.sender} readOnly tabIndex={-1} />
          </label>
          <p className={`settings__status${info.email_configured ? '' : ' is-warning'}`}>
            {info.email_configured ? t.emailConfigured : t.emailNotConfigured}
          </p>
          <div className="settings__actions">
            <button type="submit" className="btn btn--primary" disabled={busy !== null}>
              {busy === 'save' ? t.saving : t.save}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy !== null || !info.email_configured}
              onClick={() => void test()}
            >
              {busy === 'test' ? t.testSending : t.sendTest}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
