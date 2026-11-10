import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import {
  getMailSettings,
  saveMailSettings,
  sendTestMail,
  type MailSettings,
  type MailSettingsInfo,
} from '../../api/settings'
import { AdminTabs } from '../../components/AdminTabs'
import { LanguageToggle } from '../../components/LanguageToggle'
import { useAdminText } from '../../i18n/adminText'
import './FruitsDevPage.css'
import './SettingsPage.css'

/** "a@b.ch, c@d.ch" <-> ["a@b.ch", "c@d.ch"] */
const toList = (text: string) => text.split(/[\s,;]+/).filter(Boolean)
const toText = (list: string[]) => list.join(', ')

/** Verwaltung settings: where the report emails go (test or production addresses), and from whom */
export function SettingsPage() {
  const { t } = useAdminText()
  const [info, setInfo] = useState<MailSettingsInfo | null>(null)
  const [testText, setTestText] = useState('')
  const [productionText, setProductionText] = useState('')
  const [useProduction, setUseProduction] = useState(false)
  const [senderText, setSenderText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)

  function show(settings: MailSettingsInfo) {
    setInfo(settings)
    setTestText(toText(settings.test_recipients))
    setProductionText(toText(settings.production_recipients))
    setUseProduction(settings.use_production)
    setSenderText(settings.sender ?? '')
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

  /** The form as settings; null (with an error shown) if the active list is empty */
  function formSettings(): MailSettings | null {
    const settings = {
      test_recipients: toList(testText),
      production_recipients: toList(productionText),
      use_production: useProduction,
      sender: senderText.trim() || null,
    }
    if ((useProduction ? settings.production_recipients : settings.test_recipients).length === 0) {
      setError(t.activeListEmpty)
      return null
    }
    return settings
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const settings = formSettings()
    if (!settings) return
    setBusy('save')
    setError(null)
    try {
      show(await saveMailSettings(settings))
      setNotice(t.settingsSaved)
    } catch (e) {
      if (e instanceof ApiError) setError(e.status === 422 ? t.invalidEmails : e.message)
      else setError(t.nothingSaved)
    } finally {
      setBusy(null)
    }
  }

  /** Sends a test email with what is on the page (not saved); a failure shows the reason */
  async function test() {
    const settings = formSettings()
    if (!settings) return
    setBusy('test')
    setError(null)
    try {
      const result = await sendTestMail(settings)
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
          <div className="settings__field">
            <span className="settings__label">{t.sendTo}</span>
            <div className="segmented" role="radiogroup" aria-label={t.sendTo}>
              {([false, true] as const).map((production) => (
                <button
                  key={String(production)}
                  type="button"
                  role="radio"
                  aria-checked={useProduction === production}
                  className={useProduction === production ? 'is-active' : ''}
                  onClick={() => setUseProduction(production)}
                >
                  {production ? t.modeProduction : t.modeTest}
                </button>
              ))}
            </div>
          </div>
          <label className="settings__field">
            <span className="settings__label">{t.testRecipients}</span>
            <input
              className={useProduction ? '' : 'is-active'}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="settings__field">
            <span className="settings__label">{t.productionRecipients}</span>
            <input
              className={useProduction ? 'is-active' : ''}
              value={productionText}
              onChange={(e) => setProductionText(e.target.value)}
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="settings__field">
            <span className="settings__label">{t.sender}</span>
            <input
              type="email"
              value={senderText}
              placeholder={info.server_sender}
              onChange={(e) => setSenderText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
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
