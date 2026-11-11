import { Leaf, Mountain, PawPrint, Waves, Zap } from 'lucide-react'
import { POINTS, ZONES } from '../data/atlasContent.js'
import { PROVINCES, project } from './drcMapData.js'

// Données de l'atlas préparées pour l'affichage : points projetés sur la
// carte dans l'ordre du parcours, région de chaque point, cadres des régions.

export const CATEGORY_ICONS = { faune: PawPrint, flore: Leaf, eaux: Waves, reliefs: Mountain, barrages: Zap }

// Parcours de découverte : une boucle géographique à travers le pays.
export const TOUR = ['okapi', 'foret-ituri', 'fleuve-congo', 'chutes-boyoma', 'yangambi', 'bonobo', 'foret-cuvette', 'paon-congo', 'lac-mai-ndombe', 'elephant-foret', 'lesula', 'poisson-tigre', 'girafe-kordofan', 'rwenzori', 'hippopotame', 'gorille-montagnes', 'nyiragongo', 'lac-kivu', 'gorille-grauer', 'lac-tanganyika', 'bec-en-sabot', 'chutes-lofoi', 'miombo', 'palmier', 'chutes-zongo', 'rapides-inga', 'mangroves']

const ZONE_OF_PROVINCE = new Map(ZONES.flatMap((z) => z.provinces.map((name) => [name, z.id])))
export const toXY = ([lat, lon]) => project(lon, lat)
const numbers = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number)

function bbox(ds) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const d of ds) {
    const n = numbers(d)
    for (let i = 0; i < n.length; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i])
      y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1])
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export const ZONE_BOXES = new Map(ZONES.map((z) => [z.id, bbox(PROVINCES.filter((p) => z.provinces.includes(p.name)).map((p) => p.d))]))

// Points du parcours, puis les autres (barrages…) à la suite.
export const ATLAS_POINTS = [...TOUR, ...POINTS.map((p) => p.id).filter((id) => !TOUR.includes(id))].map((id) => {
  const p = POINTS.find((point) => point.id === id)
  const [x, y] = toXY(p.at)
  // Région : celle de la (première) province, sauf mention explicite.
  return { ...p, x, y, zone: p.zone ?? ZONE_OF_PROVINCE.get(p.province.split(' et ')[0]) }
})


// Points trop proches d'un voisin : leur nom n'apparaît qu'au survol, pour
// éviter que les étiquettes se chevauchent.
for (const p of ATLAS_POINTS) p.crowded = ATLAS_POINTS.some((q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 24)
