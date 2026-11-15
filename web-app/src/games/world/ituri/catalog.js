// Environnement « Lisière de l'Ituri » : description sans dépendance 3D.
//
// Ce fichier est lu par le moteur (placement des éléments), par l'interface
// (noms, carte) et par l'administration (cibles possibles des missions).
//
// Fidélité : la faune et la flore sont celles que les fiches de l'atlas
// d'URITHI situent dans les forêts de l'Ituri et de la cuvette. Le village
// est un décor stylisé, qui ne représente aucune communauté précise : les
// contenus culturels n'y sont présentés qu'à travers les fiches publiées dans
// URITHI. Les personnages sont des guides fictifs ; ce qu'ils racontent est
// tiré des fiches documentées, citées à l'écran.
//
// Couverture de la plateforme : les espaces du village suivent le
// référentiel des catégories (un espace par catégorie racine, créé
// automatiquement), chaque fiche de l'atlas a sa place (espèce modélisée,
// trace en forêt ou vue depuis la longue-vue du belvédère), et les
// communautés, langues, lieux et médias publiés ont leurs propres espaces.

import { POINTS } from '../../../data/atlasContent.js'

export const WORLD_SIZE = 260
export const PLAY_RADIUS = 104

// Tracé de la rivière : abscisse du lit selon la profondeur z.
export const riverX = (z) => 14 + 9 * Math.sin(z * 0.03) + 4 * Math.sin(z * 0.071 + 1)
export const RIVER_HALF_WIDTH = 7

export const VILLAGE = { x: -30, z: 20, r: 24 }
export const BELVEDERE = { x: 66, z: -62, r: 12, height: 11 }
export const BRIDGE_Z = 6
export const SPAWN = { x: -30, z: 46, ry: Math.PI }

export const ZONES = [
  { id: 'village', name: 'Le village', hint: 'Un village de démonstration, au bord de la rivière' },
  { id: 'riviere', name: 'La rivière', hint: 'Un affluent paisible, que l’on traverse à gué ou par le pont' },
  { id: 'foret', name: 'La forêt', hint: 'Forêt dense humide, inspirée de la forêt de l’Ituri' },
  { id: 'belvedere', name: 'Le belvédère', hint: 'Une colline qui domine la canopée' },
  { id: 'lisiere', name: 'La lisière', hint: 'Champs et jeunes forêts autour du village' },
]

const inCircle = (x, z, c) => Math.hypot(x - c.x, z - c.z) < c.r

export function zoneAt(x, z) {
  if (inCircle(x, z, BELVEDERE)) return 'belvedere'
  if (inCircle(x, z, VILLAGE)) return 'village'
  const dx = x - riverX(z)
  if (Math.abs(dx) < RIVER_HALF_WIDTH + 4) return 'riviere'
  if (dx > RIVER_HALF_WIDTH + 12 || z < -38) return 'foret'
  return 'lisiere'
}

// Espèces observables : l'identifiant est celui de la fiche de l'atlas.
//   kind : plant (à identifier) ou animal (à observer)
export const SUBJECTS = [
  { id: 'palmier', kind: 'plant', x: -10, z: 36 },
  { id: 'parasolier', kind: 'plant', x: 40, z: 24 },
  { id: 'limbali', kind: 'plant', x: 62, z: -18 },
  { id: 'fumbwa', kind: 'plant', x: 47, z: -40 },
  { id: 'okapi', kind: 'animal', x: 60, z: 6, roam: 13 },
  { id: 'elephant-foret', kind: 'animal', x: 54, z: 54, roam: 15 },
  { id: 'paon-congo', kind: 'animal', x: 30, z: -54, roam: 9 },
]

// Espaces du village. Les cinq premiers ont un décor propre et sont
// rattachés à leur catégorie par le code du référentiel (stable, alors que
// le slug peut différer d'une base à l'autre) ; les autres
// catégories racines du référentiel reçoivent un espace sur l'un des
// emplacements libres (STATION_SLOTS), dans l'ordre du référentiel.
export const STATIONS = [
  { id: 'cuisine', code: 'D', name: 'Le foyer', theme: 'Gastronomie et alimentation', category: 'gastronomie-et-alimentation', x: -41, z: 13, icon: 'cooking' },
  { id: 'habits', code: 'I', name: 'L’atelier des étoffes', theme: 'Vêtements, coiffures et parures', category: 'vetements-coiffures-et-parures', x: -19, z: 29, icon: 'cloth' },
  { id: 'memoire', code: 'B', name: 'La maison de la mémoire', theme: 'Histoire et mémoire collective', category: 'histoire-et-memoire-collective', x: -33, z: 4, icon: 'memory' },
  { id: 'langues', code: 'C', name: 'La place des paroles', theme: 'Langues et expressions', category: 'langues-et-expressions', x: -16, z: 14, icon: 'speech', languages: true },
  { id: 'artisanat', code: 'J', name: 'L’atelier', theme: 'Artisanat et savoir-faire', category: 'artisanat-et-savoir-faire', x: -44, z: 28, icon: 'craft' },
]

// Espaces transversaux : tout le référentiel, les communautés (avec leurs
// lieux et leurs langues) et la médiathèque.
export const HUBS = [
  { id: 'savoirs', kind: 'savoirs', name: 'La maison des savoirs', theme: 'Tous les thèmes du référentiel', x: -30, z: -1, icon: 'memory' },
  { id: 'communautes', kind: 'communautes', name: 'L’arbre à palabres', theme: 'Communautés, lieux et langues', x: -32.5, z: 28.1, icon: 'palaver' },
  { id: 'mediatheque', kind: 'mediatheque', name: 'La case des sons et des images', theme: 'Médiathèque', x: -12.5, z: 31.7, icon: 'media' },
]

// Emplacements libres du village (calculés pour éviter cases, espaces,
// personnages et point de départ), occupés dans l'ordre.
export const STATION_SLOTS = [
  [-9, 20], [-9.9, 26.1], [-20.1, 38.5], [-25.9, 40.6], [-38, 39.4], [-43.3, 36.2], [-47.5, 31.7], [-50.1, 26.1], [-51, 20],
  [-50.1, 13.9], [-41.7, 2.5], [-36.1, -0.1], [-23.9, -0.1], [-12.5, 8.3], [-9.9, 13.9], [-21.5, 20.8], [-23.4, 25.4],
  [-27.5, 28.1], [-36.6, 25.4], [-36, 14], [-31.7, 11.7], [-26.7, 12.1], [-15.6, 35.9], [-48.4, 8.9], [-18.9, 1.6],
].map(([x, z]) => ({ x, z }))

const themeSpaceName = (name) => `Espace « ${name} »`

// Espaces du village pour un référentiel donné (catégories racines).
// Sans référentiel (hors ligne), seuls les espaces fixes sont présents.
let lastRoots = null
let lastStations = null
export function villageStations(roots = []) {
  if (roots === lastRoots && lastStations) return lastStations
  lastRoots = roots
  lastStations = buildStations(roots)
  return lastStations
}

function buildStations(roots) {
  const byCode = new Map(roots.map((c) => [c.code, c]))
  const fixed = new Set(STATIONS.map((s) => s.code))
  const extra = roots.filter((c) => !fixed.has(c.code))
  const themed = extra.slice(0, STATION_SLOTS.length).map((c, i) => ({
    id: `theme-${c.slug}`,
    name: themeSpaceName(c.name),
    theme: c.name,
    category: c.slug,
    ...STATION_SLOTS[i],
    icon: 'theme',
  }))
  const own = STATIONS.map((s) => {
    const c = byCode.get(s.code)
    return c ? { ...s, category: c.slug, theme: c.name } : s
  })
  return [...own, ...themed, ...HUBS]
}

// ---- Atlas vivant ------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Longue-vue du belvédère : on y découvre les paysages du pays (eaux,
// reliefs, barrages) et l'on y retrouve toutes les fiches de l'atlas.
export const PANORAMA = { id: 'panorama', x: BELVEDERE.x - 3, z: BELVEDERE.z + 3 }
export const LANDSCAPE_CATEGORIES = ['eaux', 'reliefs', 'barrages']
// Personnages. « story » : paragraphes lus dans les fiches de l'atlas
// [identifiant, numéro du paragraphe].
export const NPCS = [
  {
    id: 'ecogarde',
    name: 'Baraka',
    role: 'Écogarde',
    x: 31,
    z: 1,
    ry: -Math.PI / 2,
    outfit: { shirt: '#4d6b3c', pants: '#3b4a2c', hat: '#3b4a2c', skin: '#6b4423' },
    greeting: 'Bonjour, gardien ! Je suis Baraka, écogarde. Je veille sur cette forêt et sur les animaux qui y vivent.',
    story: [
      ['foret-ituri', 0],
      ['foret-ituri', 1],
      ['okapi', 0],
      ['elephant-foret', 1],
    ],
    farewell: 'Approchez-vous des animaux en marchant, sans courir : ils sont farouches. Et gardez l’œil ouvert, chaque arbre a son histoire.',
  },
  {
    id: 'guide-village',
    name: 'Amani',
    role: 'Guide du village',
    x: -25,
    z: 17,
    ry: Math.PI / 2,
    outfit: { shirt: '#c2552b', pants: '#2f4b7c', wrap: '#ffb547', skin: '#5a3a22' },
    greeting: 'Karibu ! Je suis Amani, votre guide. Ce village est un décor imaginaire, mais ce que vous y découvrirez ne l’est pas.',
    lines: [
      'Chaque espace du village ouvre les fiches culturelles documentées avec les communautés et publiées dans URITHI : gastronomie, vêtements, langues, mémoire collective, savoir-faire.',
      'Lorsqu’une fiche est encore incomplète ou en cours de vérification, c’est indiqué clairement. Rien n’est présenté comme vérifié tant que la communauté et les validateurs ne l’ont pas confirmé.',
    ],
    farewell: 'Allez voir le foyer, l’atelier des étoffes ou la maison de la mémoire. Bonne découverte !',
  },
]

// Traces : chaque fiche de faune ou de flore de l'atlas qui n'a pas de
// modèle 3D est signalée en forêt ou en lisière par une borne d'observation.
// Une fiche ajoutée à l'atlas reçoit donc sa trace automatiquement.
export const TRACES = (() => {
  const placed = new Set(SUBJECTS.map((s) => s.id))
  const wanted = POINTS.filter((p) => (p.category === 'faune' || p.category === 'flore') && !placed.has(p.id))
  const keepOut = [...SUBJECTS, ...NPCS, PANORAMA, { x: SPAWN.x, z: SPAWN.z }]
  const random = rng(20261115)
  const out = []
  for (let tries = 0; out.length < wanted.length && tries < 6000; tries++) {
    const p = wanted[out.length]
    const x = (random() * 2 - 1) * (PLAY_RADIUS - 8)
    const z = (random() * 2 - 1) * (PLAY_RADIUS - 8)
    if (Math.hypot(x, z) > PLAY_RADIUS - 8) continue
    const zone = zoneAt(x, z)
    if (p.category === 'faune' ? zone !== 'foret' : zone !== 'foret' && zone !== 'lisiere') continue
    if (Math.abs(x - riverX(z)) < RIVER_HALF_WIDTH + 4) continue
    if (keepOut.some((k) => Math.hypot(k.x - x, k.z - z) < 9)) continue
    if (out.some((k) => Math.hypot(k.x - x, k.z - z) < 11)) continue
    out.push({ id: p.id, kind: p.category === 'faune' ? 'animal' : 'plant', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 })
  }
  return out
})()

// Fiches de l'atlas présentes dans le monde, par catégorie.
export const atlasIds = (category) => POINTS.filter((p) => p.category === category).map((p) => p.id)

// Repères des zones (carte et marqueurs des étapes d'exploration).
export const ZONE_CENTERS = {
  village: { x: VILLAGE.x, z: VILLAGE.z },
  riviere: { x: riverX(-20), z: -20 },
  foret: { x: 58, z: 4 },
  belvedere: { x: BELVEDERE.x, z: BELVEDERE.z },
  lisiere: { x: -4, z: 44 },
}

export const ENVIRONMENT = {
  id: 'ituri',
  name: 'Lisière de l’Ituri',
  description:
    'Un village au bord d’une rivière, à la lisière d’une forêt dense humide inspirée de la forêt de l’Ituri et de la Réserve de faune à okapis.',
  zones: ZONES,
  subjects: SUBJECTS,
  stations: STATIONS,
  npcs: NPCS,
}

export const ENVIRONMENTS = { ituri: ENVIRONMENT }

// Cibles possibles d'une étape de mission, par type (pour l'administration).
// « platform » : référentiel et communautés publiés (catégories racines,
// communautés), pour les cibles qui suivent la plateforme.
export const ATLAS_GROUP = (category) => `atlas-${category}`
export const ALL = 'toutes'

export function stepTargets(environmentId, type, platform = {}) {
  const env = ENVIRONMENTS[environmentId]
  if (!env) return []
  const point = (id) => POINTS.find((p) => p.id === id)
  const roots = platform.roots ?? []
  const communities = platform.communities ?? []
  if (type === 'explore') return env.zones.map((z) => ({ id: z.id, label: z.name }))
  if (type === 'identify') {
    const ids = [...env.subjects.filter((s) => s.kind === 'plant').map((s) => s.id), ...TRACES.filter((t) => t.kind === 'plant').map((t) => t.id)]
    return [{ id: ATLAS_GROUP('flore'), label: 'Toute plante de l’atlas', group: true }, ...ids.map((id) => ({ id, label: point(id)?.name ?? id }))]
  }
  if (type === 'discover') {
    const ids = [...env.subjects.filter((s) => s.kind === 'animal').map((s) => s.id), ...TRACES.filter((t) => t.kind === 'animal').map((t) => t.id)]
    return [
      { id: ATLAS_GROUP('faune'), label: 'Tout animal de l’atlas', group: true },
      ...LANDSCAPE_CATEGORIES.map((c) => ({ id: ATLAS_GROUP(c), label: `Tout paysage « ${c} » (longue-vue)`, group: true })),
      ...ids.map((id) => ({ id, label: point(id)?.name ?? id })),
      ...POINTS.filter((p) => LANDSCAPE_CATEGORIES.includes(p.category)).map((p) => ({ id: p.id, label: `${p.name} (longue-vue)` })),
    ]
  }
  if (type === 'talk' || type === 'quiz') return env.npcs.map((n) => ({ id: n.id, label: `${n.name} (${n.role})` }))
  if (type === 'consult') return villageStations(roots).map((s) => ({ id: s.id, label: `${s.name} · ${s.theme}` }))
  if (type === 'read') {
    return [
      { id: ALL, label: 'Toute fiche publiée', group: true },
      ...roots.map((c) => ({ id: `categorie-${c.slug}`, label: `Thème : ${c.name}`, group: true })),
      ...communities.map((c) => ({ id: `communaute-${c.slug}`, label: `Communauté : ${c.name}`, group: true })),
    ]
  }
  if (type === 'community') return [{ id: ALL, label: 'Toute communauté publiée', group: true }, ...communities.map((c) => ({ id: c.slug, label: c.name }))]
  return []
}
