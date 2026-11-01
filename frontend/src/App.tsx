import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { startAutoFlush } from './lib/reportQueue'
import { FruitsDevPage } from './pages/dev/FruitsDevPage'
import { HomePage } from './pages/HomePage'
import { InventoryPage } from './pages/worker/InventoryPage'

function App() {
  // Reports saved offline are sent in the background, whichever page is open (F-4)
  useEffect(() => startAutoFlush(), [])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/bestand" element={<InventoryPage />} />
      <Route path="/verwaltung" element={<FruitsDevPage />} />
      {/* Old address of the catalogue page */}
      <Route path="/dev/fruits" element={<Navigate to="/verwaltung" replace />} />
    </Routes>
  )
}

export default App
