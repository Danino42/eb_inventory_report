import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { startAutoFlush } from './lib/reportQueue'
import { AdminGate } from './pages/dev/AdminGate'
import { FruitsDevPage } from './pages/dev/FruitsDevPage'
import { OrderArticlesPage } from './pages/dev/OrderArticlesPage'
import { HomePage } from './pages/HomePage'
import { InventoryPage } from './pages/worker/InventoryPage'

function App() {
  // Reports saved offline are sent in the background, whichever page is open (F-4)
  useEffect(() => startAutoFlush(), [])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/bestand" element={<InventoryPage />} />
      {/* Both Verwaltung tabs sit behind one PIN screen */}
      <Route path="/verwaltung" element={<AdminGate />}>
        <Route index element={<FruitsDevPage />} />
        <Route path="bestellartikel" element={<OrderArticlesPage />} />
      </Route>
      {/* Old address of the catalogue page */}
      <Route path="/dev/fruits" element={<Navigate to="/verwaltung" replace />} />
    </Routes>
  )
}

export default App
