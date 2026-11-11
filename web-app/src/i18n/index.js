// Internationalisation de l'interface (§64). Le français est la langue de
// référence : toute clé absente d'une autre langue s'affiche en français.
//
// L'application est pour l'instant uniquement en français. Les traductions
// (locales/en.js, ln.js, sw.js) sont conservées : pour réactiver une langue,
// réimportez son fichier et ajoutez-la à LANGUAGES et DICTIONARIES ; les
// sélecteurs de langue réapparaissent dès qu'il y a plus d'une langue.
//
// Les textes sont lus via t('clé'). Changer de langue recharge la page : les
// listes de libellés déclarées au chargement des modules sont ainsi relues
// dans la nouvelle langue.
import fr from './locales/fr.js'

export const LANGUAGES = [
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
]

const DICTIONARIES = { fr }
const STORAGE_KEY = 'urithi.langue'

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (DICTIONARIES[saved]) return saved
  } catch {
    // Stockage indisponible (navigation privée) : on poursuit la détection.
  }
  const browser = (navigator.languages ?? [navigator.language ?? 'fr']).map((l) => l.slice(0, 2).toLowerCase())
  return browser.find((code) => DICTIONARIES[code]) ?? 'fr'
}

let current = detect()

function applyToDocument() {
  document.documentElement.lang = current
  document.title = t('meta.title')
  // Mention « Obligatoire » affichée par la feuille de style.
  document.documentElement.style.setProperty('--required-label', JSON.stringify(t('common.required')))
}

export function getLanguage() {
  return current
}

export function setLanguage(code) {
  if (!DICTIONARIES[code] || code === current) return
  current = code
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // La langue reste active pour la session même sans stockage.
  }
  window.location.reload()
}

// Traduction avec variables : t('carte.contenus', { n: 3 }) remplace {n}.
export function t(key, vars) {
  let text = DICTIONARIES[current][key] ?? fr[key]
  if (text === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${key}`)
    return key
  }
  if (vars) text = text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match))
  return text
}

// Pluriel : choisit « clé.one » ou « clé.other » selon la langue.
export function tn(key, n, vars = {}) {
  const one = current === 'fr' ? n <= 1 : n === 1
  return t(`${key}.${one ? 'one' : 'other'}`, { n, ...vars })
}

// Locale pour les dates et les nombres, avec repli si le navigateur ne la
// connaît pas.
export function locale() {
  const wanted = LANGUAGES.find((l) => l.code === current).locale
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([wanted]).length ? wanted : 'fr-FR'
  } catch {
    return 'fr-FR'
  }
}

applyToDocument()
