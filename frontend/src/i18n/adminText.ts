// German / English texts of the Verwaltung area (fruit catalogue, order articles).
// Data (article texts, supplier names, notes) is shown as it is and not translated.

import { useSyncExternalStore } from 'react'

export type Lang = 'de' | 'en'

const STORAGE_KEY = 'eb-admin-lang'
const CHANGE_EVENT = 'eb-admin-lang-change'

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'de'
  } catch {
    return 'de'
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Not remembered if storage is blocked; the page still switches
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

const de = {
  // Shared
  otherLanguage: 'English',
  darkMode: 'Dunkelmodus',
  lightMode: 'Hellmodus',
  tabFruits: 'Früchtekatalog',
  tabOrders: 'Bestellartikel',
  loading: 'Laden…',
  search: 'Suche',
  all: 'Alle',
  clearFilters: 'Filter zurücksetzen',
  edit: 'Bearbeiten',
  delete: 'Löschen',
  cancel: 'Abbrechen',
  save: 'Speichern',
  saving: 'Speichern…',
  discardChanges: 'Änderungen verwerfen?',
  offline: 'Keine Verbindung zum Server. Bitte Verbindung prüfen und erneut versuchen.',
  nothingSaved: 'Keine Verbindung zum Server. Nichts wurde gespeichert.',
  added: (name: string) => `${name} hinzugefügt`,
  saved: (name: string) => `${name} gespeichert`,
  deleted: (name: string) => `${name} gelöscht`,
  monthsLong: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  monthsShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],

  // PIN screen
  adminTitle: 'Verwaltung',
  wrongPin: 'Falsche PIN',
  checkingPin: 'PIN wird geprüft…',
  eraseDigit: 'Ziffer löschen',

  // Settings
  tabSettings: 'Einstellungen',
  settingsTitle: 'Einstellungen',
  reportEmails: 'Berichte per E-Mail',
  sendTo: 'Senden an',
  modeTest: 'Test',
  modeProduction: 'Produktion',
  testRecipients: 'Test-Empfänger',
  productionRecipients: 'Produktiv-Empfänger',
  emailConfigured: 'E-Mail-Versand ist eingerichtet.',
  emailNotConfigured: 'Auf dem Server ist noch kein E-Mail-Versand eingerichtet: Berichte werden nur gespeichert.',
  settingsSaved: 'Einstellungen gespeichert',
  invalidEmails: 'Bitte gültige E-Mail-Adressen eingeben, mehrere mit Komma getrennt.',
  activeListEmpty: 'Für die gewählten Empfänger ist keine Adresse eingetragen.',

  // Fruit catalogue
  fruitsTitle: 'Früchtekatalog',
  detailedView: 'Detailansicht',
  simpleView: 'Einfache Ansicht',
  addFruit: 'Frucht hinzufügen',
  month: 'Monat',
  allMonths: 'Alle Monate',
  thisMonth: 'Dieser Monat',
  boxType: 'Boxtyp',
  allBoxes: 'Alle Boxen',
  category: 'Kategorie',
  unit: 'Einheit',
  fruitNamePlaceholder: 'Name der Frucht',
  fruitsCount: (n: number, month?: string) => `${n} Früchte${month ? ` im ${month} verfügbar` : ''}`,
  colFruit: 'Frucht',
  colMonths: 'Monate',
  colDevName: 'Dev-Name',
  colArticleNumber: 'Art.-Nr.',
  colGerman: 'Deutsch',
  colEnglish: 'Englisch',
  categories: { box: 'Boxfrucht', addon: 'Add-on' },
  units: { kg: 'kg', pcs: 'Stk (Stück)' },
  variants: { conventional: 'Konventionell', bio: 'Bio' },
  addonMark: 'Add-on',

  // Fruit editor
  editFruit: (name: string) => `${name} bearbeiten`,
  germanName: 'Deutscher Name',
  englishName: 'Englischer Name',
  devName: 'Dev-Name',
  devNameHint: 'Nur Kleinbuchstaben, Zahlen und _ (z.B. apple_gala)',
  articleNumber: 'Artikelnummer',
  stockedAs: 'Geführt als',
  note: 'Notiz',
  availability: 'Verfügbarkeit',
  allYear: 'Ganzes Jahr',
  clearMonths: 'Leeren',
  devNameTaken: (name: string) => `Der Dev-Name "${name}" ist schon vergeben. Bitte einen anderen wählen.`,
  confirmDeleteFruit: (name: string) => `${name} löschen? Die Frucht verschwindet für alle aus der Liste.`,

  // Order articles
  ordersTitle: 'Bestellartikel',
  demoData: 'Demo-Daten',
  addArticle: 'Artikel hinzufügen',
  supplier: 'Lieferant',
  allSuppliers: 'Alle Lieferanten',
  articlePlaceholder: 'Artikel',
  ordersCount: (n: number, suppliers: number) => `${n} Artikel von ${suppliers} Lieferanten`,
  colArticle: 'Artikel / Text',
  colUnitPrice: 'EP',
  colNeeded: 'EK-Menge',
  colCrates: 'Anz. Kisten',
  colOrdered: 'Bestellmenge',
  total: (amount: string) => `Gesamt ${amount} Einh.`,
  orderUnits: { kg: 'kg', Stk: 'Stk', Sch: 'Sch' },

  // Order article editor
  editArticle: 'Artikel bearbeiten',
  unitPriceChf: 'EP (CHF)',
  fruitInCatalogue: 'Frucht im Katalog',
  invalidNumbers: 'Bitte nur Zahlen ab 0 eingeben (z.B. 4.5).',
  cratesWhole: 'Anz. Kisten muss eine ganze Zahl sein.',
  confirmDeleteArticle: (text: string) => `«${text}» löschen?`,
}

export type AdminText = typeof de

const en: AdminText = {
  otherLanguage: 'Deutsch',
  darkMode: 'Dark mode',
  lightMode: 'Light mode',
  tabFruits: 'Fruit catalogue',
  tabOrders: 'Order articles',
  loading: 'Loading…',
  search: 'Search',
  all: 'All',
  clearFilters: 'Clear filters',
  edit: 'Edit',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  discardChanges: 'Discard your changes?',
  offline: "Can't connect to the server. Check the connection and try again.",
  nothingSaved: "Can't connect to the server. Nothing was saved.",
  added: (name) => `${name} added`,
  saved: (name) => `${name} saved`,
  deleted: (name) => `${name} deleted`,
  monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  adminTitle: 'Administration',
  wrongPin: 'Wrong PIN',
  checkingPin: 'Checking PIN…',
  eraseDigit: 'Delete digit',

  tabSettings: 'Settings',
  settingsTitle: 'Settings',
  reportEmails: 'Report emails',
  sendTo: 'Send to',
  modeTest: 'Test',
  modeProduction: 'Production',
  testRecipients: 'Test recipients',
  productionRecipients: 'Production recipients',
  emailConfigured: 'Email sending is set up.',
  emailNotConfigured: 'Email sending is not set up on the server yet: reports are only saved.',
  settingsSaved: 'Settings saved',
  invalidEmails: 'Please enter valid email addresses, several separated by commas.',
  activeListEmpty: 'The selected recipients have no address.',

  fruitsTitle: 'Fruit catalogue',
  detailedView: 'Detailed view',
  simpleView: 'Simple view',
  addFruit: 'Add fruit',
  month: 'Month',
  allMonths: 'All months',
  thisMonth: 'This month',
  boxType: 'Box type',
  allBoxes: 'All boxes',
  category: 'Category',
  unit: 'Unit',
  fruitNamePlaceholder: 'Fruit name',
  fruitsCount: (n, month) => `${n} fruits${month ? ` available in ${month}` : ''}`,
  colFruit: 'Fruit',
  colMonths: 'Months',
  colDevName: 'Dev name',
  colArticleNumber: 'Art. no.',
  colGerman: 'German',
  colEnglish: 'English',
  categories: { box: 'Box fruit', addon: 'Add-on' },
  units: { kg: 'kg', pcs: 'pcs (pieces)' },
  variants: { conventional: 'Conventional', bio: 'Organic' },
  addonMark: 'add-on',

  editFruit: (name) => `Edit ${name}`,
  germanName: 'German name',
  englishName: 'English name',
  devName: 'Dev name',
  devNameHint: 'Only small letters, numbers and _ (for example apple_gala)',
  articleNumber: 'Article number',
  stockedAs: 'Stocked as',
  note: 'Note',
  availability: 'Availability',
  allYear: 'All year',
  clearMonths: 'Clear',
  devNameTaken: (name) => `The dev name "${name}" is already used by another fruit. Please choose a different one.`,
  confirmDeleteFruit: (name) => `Delete ${name}? It will be removed from the list for everyone.`,

  ordersTitle: 'Order articles',
  demoData: 'demo data',
  addArticle: 'Add article',
  supplier: 'Supplier',
  allSuppliers: 'All suppliers',
  articlePlaceholder: 'Article',
  ordersCount: (n, suppliers) => `${n} articles from ${suppliers} suppliers`,
  colArticle: 'Article',
  colUnitPrice: 'Unit price',
  colNeeded: 'Needed',
  colCrates: 'Crates',
  colOrdered: 'Ordered',
  total: (amount) => `Total ${amount} units`,
  orderUnits: { kg: 'kg', Stk: 'pcs', Sch: 'trays' },

  editArticle: 'Edit article',
  unitPriceChf: 'Unit price (CHF)',
  fruitInCatalogue: 'Fruit in catalogue',
  invalidNumbers: 'Please enter numbers from 0 (e.g. 4.5).',
  cratesWhole: 'Crates must be a whole number.',
  confirmDeleteArticle: (text) => `Delete "${text}"?`,
}

const TEXT: Record<Lang, AdminText> = { de, en }

/** Current language and its texts; re-renders when the language is switched */
export function useAdminText(): { lang: Lang; t: AdminText } {
  const lang = useSyncExternalStore(subscribe, readLang)
  return { lang, t: TEXT[lang] }
}
