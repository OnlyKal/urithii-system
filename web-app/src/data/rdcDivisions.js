import RDC_DIVISIONS from './rdcDivisions.json'

// Provinces et territoires de la RDC (copie identique de
// server-app/src/data/rdcDivisions.json, vérifiée par les tests du serveur).
export const PROVINCES = RDC_DIVISIONS.provinces

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-\s]+/g, ' ').trim()
const byName = new Map(PROVINCES.map((p) => [norm(p.name), p]))

// Province à partir d'un nom saisi (accents, casse et tirets ignorés).
export const findProvince = (name) => byName.get(norm(name)) ?? null

// Provinces reconnues d'un champ « province » : un nom (une seule province)
// ou une liste de noms (plusieurs provinces), sans doublon.
export function provincesOf(value) {
  const found = (Array.isArray(value) ? value : [value]).map(findProvince).filter(Boolean)
  return found.filter((p, i) => found.indexOf(p) === i)
}

// Territoires des provinces données cités dans un ancien texte libre.
export function territoriesInText(provinces, text) {
  // Mots séparés par tout ce qui n'est ni lettre ni chiffre (« d’Idjwi »).
  const words = (s) => ` ${norm(s).replace(/[^a-z0-9]+/g, ' ').trim()} `
  const t = words(text)
  return provinces.flatMap((p) => p.territories).filter((name) => t.includes(words(name)))
}

export const normalizeText = norm
