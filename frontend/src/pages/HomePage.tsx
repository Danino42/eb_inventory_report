import { Link } from 'react-router'
import { FruitIcon } from '../components/FruitIcon'
import { ThemeToggle } from '../components/ThemeToggle'
import { flushQueue } from '../lib/reportQueue'
import { usePendingReports } from '../lib/usePendingReports'
import { defaultReportDate, formatReportDate } from './worker/reportDate'
import './HomePage.css'

/** Start screen on the tablet: pick the inventory form or the catalogue */
export function HomePage() {
  const { weekday, date } = formatReportDate(defaultReportDate())
  const { waiting, failed } = usePendingReports()

  return (
    <main className="home">
      <header className="home__header">
        <h1>Earlybird</h1>
        <ThemeToggle />
      </header>
      {(waiting > 0 || failed > 0) && (
        <div className="home__queue" role="status">
          {waiting > 0 && (
            <span>
              {waiting === 1 ? '1 Bericht wartet' : `${waiting} Berichte warten`} auf Versand
            </span>
          )}
          {failed > 0 && (
            <span className="home__queue-failed">
              {failed === 1 ? '1 Bericht wurde' : `${failed} Berichte wurden`} vom Server abgelehnt
            </span>
          )}
          {waiting > 0 && (
            <button type="button" className="btn btn--small" onClick={() => void flushQueue()}>
              Jetzt senden
            </button>
          )}
        </div>
      )}
      <nav className="home__tiles" aria-label="Bereiche">
        <Link to="/bestand" className="home__tile home__tile--primary">
          <span className="home__icons" aria-hidden="true">
            <FruitIcon devName="apple_2" size={56} />
            <FruitIcon devName="banana" size={56} />
            <FruitIcon devName="pear" size={56} />
          </span>
          <span className="home__title">Warenbestand</span>
          <span className="home__sub">
            {weekday} {date}
          </span>
        </Link>
        <Link to="/verwaltung" className="home__tile">
          <span className="home__icons" aria-hidden="true">
            <FruitIcon devName="kiwi" size={56} />
            <FruitIcon devName="lemon" size={56} />
            <FruitIcon devName="grapes_seedless" size={56} />
          </span>
          <span className="home__title">Verwaltung</span>
          <span className="home__sub">Früchtekatalog</span>
        </Link>
      </nav>
    </main>
  )
}
