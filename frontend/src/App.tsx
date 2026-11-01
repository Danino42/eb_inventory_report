import { Route, Routes } from 'react-router'
import { FruitsDevPage } from './pages/dev/FruitsDevPage'
import { HomePage } from './pages/HomePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dev/fruits" element={<FruitsDevPage />} />
    </Routes>
  )
}

export default App
