import { useState } from 'react'
import { applyTheme, getStoredTheme, type Theme } from '../theme'

/** Switches between light and dark mode; the choice is remembered on this device */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button type="button" className="btn" onClick={toggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
