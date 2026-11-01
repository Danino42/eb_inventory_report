import { Route, Routes } from 'react-router'
import { FruitsDevPage } from './pages/dev/FruitsDevPage'
import { InventoryPage } from './pages/worker/InventoryPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<InventoryPage />} />
      <Route path="/dev/fruits" element={<FruitsDevPage />} />
    </Routes>
  )
}

export default App
