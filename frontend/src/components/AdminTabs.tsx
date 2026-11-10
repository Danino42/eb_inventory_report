import { NavLink } from 'react-router'
import { useAdminText } from '../i18n/adminText'

/** Tabs of the Verwaltung area */
export function AdminTabs() {
  const { t } = useAdminText()
  return (
    <nav className="admin-tabs" aria-label="Admin">
      <NavLink to="/verwaltung" end className="admin-tabs__tab">
        {t.tabFruits}
      </NavLink>
      <NavLink to="/verwaltung/bestellartikel" className="admin-tabs__tab">
        {t.tabOrders}
      </NavLink>
      <NavLink to="/verwaltung/einstellungen" className="admin-tabs__tab">
        {t.tabSettings}
      </NavLink>
    </nav>
  )
}
