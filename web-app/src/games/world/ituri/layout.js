import { HUBS, NPCS, PANORAMA, PLAY_RADIUS, RIVER_HALF_WIDTH, riverX, SPAWN, STATION_SLOTS, STATIONS, SUBJECTS, TRACES, VILLAGE, zoneAt } from './catalog.js'
import { groundHeight, pathDistance } from './terrain.js'

// Placement de la végétation, des habitations et des rochers. Génération
// déterministe (même graine, même monde) dont la densité suit le niveau de
// qualité graphique.

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

// Habitations du village, disposées en cercle autour de la place.
export const HUTS = [
  { kind: 'round', a: 0.2, r: 15, s: 1 },
  { kind: 'round', a: 0.95, r: 16, s: 1.1 },
  { kind: 'house', a: 1.75, r: 17, s: 1 },
  { kind: 'round', a: 2.55, r: 15.5, s: 0.95 },
  { kind: 'granary', a: 3.2, r: 13, s: 1 },
  { kind: 'house', a: 3.9, r: 17, s: 1.05 },
  { kind: 'round', a: 4.7, r: 15, s: 1.05 },
  { kind: 'round', a: 5.45, r: 16.5, s: 0.9 },
].map((h) => {
  const x = VILLAGE.x + Math.cos(h.a) * h.r
  const z = VILLAGE.z + Math.sin(h.a) * h.r
  // Porte tournée vers la place.
  return { ...h, x, z, y: groundHeight(x, z), ry: Math.atan2(VILLAGE.x - x, VILLAGE.z - z) }
})

const FIRE = { x: VILLAGE.x, z: VILLAGE.z }
export { FIRE }

// Points à garder dégagés (sentiers exceptés) : espèces, personnages, espaces.
const CLEAR = [
  ...SUBJECTS.filter((s) => s.kind === 'plant').map((s) => ({ x: s.x, z: s.z, r: 4.5 })),
  ...NPCS.map((n) => ({ x: n.x, z: n.z, r: 4 })),
  ...STATIONS.map((s) => ({ x: s.x, z: s.z, r: 4 })),
  // Tous les emplacements sont réservés, occupés ou non : le monde ne
  // dépend pas du référentiel chargé.
  ...STATION_SLOTS.map((s) => ({ x: s.x, z: s.z, r: 3.6 })),
  ...HUBS.map((s) => ({ x: s.x, z: s.z, r: 4 })),
  ...TRACES.map((t) => ({ x: t.x, z: t.z, r: 3 })),
  { x: PANORAMA.x, z: PANORAMA.z, r: 3 },
  ...HUTS.map((h) => ({ x: h.x, z: h.z, r: 5.5 })),
  { x: SPAWN.x, z: SPAWN.z, r: 5 },
]

const blocked = (x, z, margin = 0) =>
  Math.hypot(x, z) > PLAY_RADIUS + 18 ||
  Math.abs(x - riverX(z)) < RIVER_HALF_WIDTH + 2.5 + margin ||
  pathDistance(x, z) < 2.6 + margin ||
  CLEAR.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin)

function scatter(random, count, accept, { tries = 12, spacing = 0, list = [] } = {}) {
  const out = []
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < tries; t++) {
      const x = (random() * 2 - 1) * 128
      const z = (random() * 2 - 1) * 128
      if (!accept(x, z)) continue
      if (spacing && [...out, ...list].some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue
      out.push({ x, z, y: groundHeight(x, z), ry: random() * Math.PI * 2, s: 0.8 + random() * 0.45 })
      break
    }
  }
  return out
}

export function buildLayout(density = 1) {
  const random = rng(20261110)
  const forest = (x, z) => zoneAt(x, z) === 'foret' && !blocked(x, z)
  const edge = (x, z) => ['lisiere', 'riviere'].includes(zoneAt(x, z)) && !blocked(x, z, 1)
  const nearVillage = (x, z) => {
    const d = Math.hypot(x - VILLAGE.x, z - VILLAGE.z)
    return d > VILLAGE.r - 3 && d < VILLAGE.r + 16 && !blocked(x, z, 1)
  }

  // Peuplement presque pur de limbali autour de l'arbre remarquable.
  const limbaliHome = SUBJECTS.find((s) => s.id === 'limbali')
  const limbali = scatter(random, Math.round(26 * density), (x, z) => Math.hypot(x - limbaliHome.x, z - limbaliHome.z) < 20 && forest(x, z), { spacing: 6 })
  const inGrove = (x, z) => Math.hypot(x - limbaliHome.x, z - limbaliHome.z) < 21

  const canopy = scatter(random, Math.round(430 * density), (x, z) => forest(x, z) && !inGrove(x, z), { spacing: 4.2 })
  const parasol = scatter(random, Math.round(26 * density), (x, z) => (edge(x, z) || (forest(x, z) && Math.abs(x - riverX(z)) < 32)) && !inGrove(x, z), { spacing: 5, list: canopy })
  const palms = [
    ...scatter(random, Math.round(22 * density), nearVillage, { spacing: 5 }),
    ...scatter(random, Math.round(14 * density), edge, { spacing: 6 }),
  ]
  const bananas = scatter(random, Math.round(26 * density), nearVillage, { spacing: 3, list: palms })
  const lisiereTrees = scatter(random, Math.round(46 * density), edge, { spacing: 7, list: palms })
  const bushes = scatter(random, Math.round(700 * density), (x, z) => !blocked(x, z, -1) && zoneAt(x, z) !== 'village', { tries: 4 })
  const ferns = scatter(random, Math.round(520 * density), (x, z) => forest(x, z), { tries: 4 })
  const grass = scatter(random, Math.round(1400 * density), (x, z) => !blocked(x, z, -1.5) && ['lisiere', 'riviere', 'village'].includes(zoneAt(x, z)) && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > 9, { tries: 3 })
  const rocks = scatter(random, 46, (x, z) => !blocked(x, z) && zoneAt(x, z) !== 'village', { tries: 6, spacing: 6 })
  const riverRocks = []
  for (let z = -100; z < 100; z += 7 + random() * 9) {
    const side = random() < 0.5 ? -1 : 1
    const x = riverX(z) + side * (RIVER_HALF_WIDTH - 1 + random() * 3)
    riverRocks.push({ x, z, y: groundHeight(x, z), ry: random() * 6, s: 0.6 + random() * 0.8 })
  }

  // Collisions : troncs, habitations, rochers.
  const colliders = [
    ...limbali.map((t) => ({ x: t.x, z: t.z, r: 0.9 * t.s })),
    ...canopy.map((t) => ({ x: t.x, z: t.z, r: 0.6 * t.s })),
    ...parasol.map((t) => ({ x: t.x, z: t.z, r: 0.5 })),
    ...palms.map((t) => ({ x: t.x, z: t.z, r: 0.45 })),
    ...lisiereTrees.map((t) => ({ x: t.x, z: t.z, r: 0.5 * t.s })),
    ...HUTS.map((h) => ({ x: h.x, z: h.z, r: (h.kind === 'house' ? 3.6 : h.kind === 'granary' ? 1.6 : 3.1) * h.s })),
    ...rocks.map((r) => ({ x: r.x, z: r.z, r: 1.1 * r.s })),
    { x: FIRE.x, z: FIRE.z, r: 1.3 },
  ]

  return { limbali, canopy, parasol, palms, bananas, lisiereTrees, bushes, ferns, grass, rocks, riverRocks, colliders }
}

// Grille de collisions : recherche rapide des obstacles proches.
export function colliderGrid(colliders, cell = 8) {
  const grid = new Map()
  for (const c of colliders) {
    const key = `${Math.floor(c.x / cell)},${Math.floor(c.z / cell)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(c)
  }
  return (x, z) => {
    const cx = Math.floor(x / cell)
    const cz = Math.floor(z / cell)
    const out = []
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(`${cx + i},${cz + j}`) ?? []))
    return out
  }
}
