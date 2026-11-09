import { setLang, useAdminText } from '../i18n/adminText'

/** Switches the Verwaltung area between German and English (remembered on this device) */
export function LanguageToggle() {
  const { lang, t } = useAdminText()
  return (
    <button
      type="button"
      className="btn"
      lang={lang === 'de' ? 'en' : 'de'}
      onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
    >
      {t.otherLanguage}
    </button>
  )
}
