import { CATEGORIES, IUCN, POINTS } from '../../data/atlasContent.js'
import { fetchItems, getPlatform, rootCategory } from './platform.js'

// Questions générées à partir des contenus d'URITHI : fiches de l'atlas et
// fiches culturelles publiées. Chaque question ne porte que sur une donnée
// présente dans la fiche (rubrique, province, nom scientifique, statut UICN,
// thème, communauté) et cite cette fiche comme source. Aucune
// connaissance n'est inventée ; les mauvaises réponses sont d'autres valeurs
// réelles de la plateforme. Les nouvelles fiches publiées enrichissent donc
// les quiz sans intervention.

export const shuffle = (list) => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Question à choix : bonne réponse + jusqu'à trois autres valeurs distinctes.
function choiceQuestion(q, answer, pool, source, sourceName, link) {
  const others = shuffle([...new Set(pool.filter((v) => v && v !== answer))]).slice(0, 3)
  if (others.length < 2) return null
  const choices = shuffle([answer, ...others])
  return { q, choices, answer: choices.indexOf(answer), source, sourceName, link }
}

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export function atlasQuestions(n = 5, { categories } = {}) {
  const pool = POINTS.filter((p) => !categories || categories.includes(p.category))
  const provinces = POINTS.map((p) => p.province)
  const latins = POINTS.map((p) => p.latin)
  const out = []
  for (const p of shuffle(pool)) {
    const link = `/atlas?lieu=${p.id}`
    const makers = shuffle([
      () => choiceQuestion(`Dans quelle province se trouve « ${p.name} » ?`, p.province, provinces, p.id, p.name, link),
      () => p.latin && choiceQuestion(`Quel est le nom scientifique de « ${p.name} » ?`, p.latin, latins, p.id, p.name, link),
      () => p.iucn && choiceQuestion(`Quel est le statut de « ${p.name} » sur la liste rouge de l’UICN ?`, IUCN[p.iucn], Object.values(IUCN), p.id, p.name, link),
      () => choiceQuestion(`Dans quelle rubrique de l’atlas vivant figure « ${p.name} » ?`, categoryLabel(p.category), CATEGORIES.map((c) => c.label), p.id, p.name, link),
    ])
    const q = makers.map((m) => m()).find(Boolean)
    if (q) out.push(q)
    if (out.length >= n) break
  }
  return out
}

// Questions sur les fiches culturelles publiées (lues par l'API publique).
export async function itemQuestions(n = 5) {
  const { items } = await fetchItems({ pageSize: 100 })
  const platform = getPlatform()
  const rootName = new Map(platform.roots.map((c) => [c.slug, c.name]))
  const themes = platform.roots.map((c) => c.name)
  const communities = [...new Set([...platform.communities.map((c) => c.name), ...items.flatMap((i) => i.communities.map((c) => c.name))])]
  const out = []
  for (const item of shuffle(items)) {
    const link = `/contenus/${item.slug}`
    const theme = item.category && (rootName.get(rootCategory(item.category.slug)) ?? item.category.name)
    const makers = shuffle([
      () => theme && choiceQuestion(`À quel thème du référentiel appartient la fiche « ${item.title} » ?`, theme, themes, item.slug, item.title, link),
      () => item.communities.length === 1 && choiceQuestion(`Quelle communauté est associée à la fiche « ${item.title} » ?`, item.communities[0].name, communities, item.slug, item.title, link),
    ])
    const q = makers.map((m) => m()).find(Boolean)
    if (q) out.push(q)
    if (out.length >= n) break
  }
  return out
}

// Quiz mêlant culture et nature ; complété par l'atlas si les fiches
// culturelles publiées sont encore peu nombreuses.
export async function mixedQuestions(n = 6, { culture = 0.5, categories } = {}) {
  let cultural = []
  try {
    cultural = await itemQuestions(Math.round(n * culture))
  } catch {
    cultural = []
  }
  return shuffle([...cultural, ...atlasQuestions(n - cultural.length, { categories })])
}
