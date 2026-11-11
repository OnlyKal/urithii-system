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

// Espaces du village : chacun présente les fiches culturelles publiées dans
// URITHI pour une catégorie du référentiel.
export const STATIONS = [
  { id: 'cuisine', name: 'Le foyer', theme: 'Gastronomie', category: 'gastronomie', x: -41, z: 13, icon: 'cooking' },
  { id: 'habits', name: 'L’atelier des étoffes', theme: 'Vêtements, coiffures et parures', category: 'vetements-coiffures-et-parures', x: -19, z: 29, icon: 'cloth' },
  { id: 'memoire', name: 'La maison de la mémoire', theme: 'Histoire et mémoire collective', category: 'histoire-et-memoire-collective', x: -33, z: 4, icon: 'memory' },
  { id: 'langues', name: 'La place des paroles', theme: 'Langues et expressions', category: 'langues-et-expressions', x: -16, z: 14, icon: 'speech' },
  { id: 'artisanat', name: 'L’atelier', theme: 'Artisanat et savoir-faire', category: 'artisanat-et-savoir-faire', x: -44, z: 28, icon: 'craft' },
]

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
export function stepTargets(environmentId, type) {
  const env = ENVIRONMENTS[environmentId]
  if (!env) return []
  if (type === 'explore') return env.zones.map((z) => ({ id: z.id, label: z.name }))
  if (type === 'identify') return env.subjects.filter((s) => s.kind === 'plant').map((s) => ({ id: s.id, label: s.id }))
  if (type === 'discover') return env.subjects.filter((s) => s.kind === 'animal').map((s) => ({ id: s.id, label: s.id }))
  if (type === 'talk' || type === 'quiz') return env.npcs.map((n) => ({ id: n.id, label: `${n.name} (${n.role})` }))
  if (type === 'consult') return env.stations.map((s) => ({ id: s.id, label: `${s.name} · ${s.theme}` }))
  return []
}
