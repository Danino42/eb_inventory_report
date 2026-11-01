export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'eb-theme'

/** The theme chosen on this device; light unless dark was picked before */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Applies the theme to the whole app (see :root[data-theme] in index.css) and remembers it */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked (e.g. private mode); the theme then just isn't remembered
  }
}
