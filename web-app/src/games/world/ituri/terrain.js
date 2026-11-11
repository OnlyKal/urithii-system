import { BELVEDERE, BRIDGE_Z, PLAY_RADIUS, RIVER_HALF_WIDTH, riverX, VILLAGE } from './catalog.js'

// Relief de l'environnement : collines douces, lit de la rivière, colline du
// belvédère, clairière du village aplanie, et remparts naturels en bordure.
// Fonctions pures : utilisées par la génération du terrain, la végétation,
// les collisions et la mini-carte.

export const WATER_Y = -0.55
const BRIDGE_DECK = 0.75
const BRIDGE_X0 = riverX(BRIDGE_Z) - 11
const BRIDGE_X1 = riverX(BRIDGE_Z) + 11
const RIVER_BED = -1.75

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const fade = (t) => t * t * (3 - 2 * t)

function valueNoise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = fade(x - xi)
  const zf = fade(z - zi)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf
}

export const fbm = (x, z) => valueNoise(x * 0.018, z * 0.018) + valueNoise(x * 0.047, z * 0.047) * 0.45 + valueNoise(x * 0.11, z * 0.11) * 0.18

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

// Sentiers : du point d'arrivée au village, du village au pont, puis à
// travers la forêt jusqu'au belvédère.
const PATHS = [
  [[-30, 50], [-30, 20], [-8, 9], [riverX(BRIDGE_Z) - 11, BRIDGE_Z]],
  [[riverX(BRIDGE_Z) + 11, BRIDGE_Z], [31, 3], [48, -8], [60, -16], [63, -34], [64, -50], [BELVEDERE.x, BELVEDERE.z]],
  [[-30, 20], [-12, 33], [-4, 40]],
  [[31, 3], [44, 14], [56, 30], [54, 52]],
  [[48, -8], [38, -30], [30, -52]],
]

function segmentDistance(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - ax - t * dx, pz - az - t * dz)
}

export function pathDistance(x, z) {
  let best = Infinity
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) best = Math.min(best, segmentDistance(x, z, path[i], path[i + 1]))
  }
  return best
}

export function groundHeight(x, z) {
  // Collines douces ; les creux restent au-dessus du niveau de la rivière.
  let h = (fbm(x, z) - 0.62) * 4.2
  // Clairière du village, presque plane.
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z)
  h = lerp(h, 0.35, smoothstep(VILLAGE.r + 8, VILLAGE.r - 6, dv))
  // Colline du belvédère.
  const db = Math.hypot(x - BELVEDERE.x, z - BELVEDERE.z)
  h += BELVEDERE.height * Math.exp(-(db * db) / (2 * 15 * 15))
  // Lit de la rivière, berges en pente douce.
  const dr = Math.abs(x - riverX(z))
  h = lerp(h, RIVER_BED, smoothstep(RIVER_HALF_WIDTH + 6, RIVER_HALF_WIDTH - 2.5, dr))
  // Remblais aux deux extrémités du pont : on y monte en pente douce.
  const bz = smoothstep(5.5, 2.5, Math.abs(z - BRIDGE_Z))
  if (bz > 0) {
    const west = BRIDGE_X0 - x
    const east = x - BRIDGE_X1
    const ramp = Math.max(west > -2 && west < 12 ? smoothstep(12, 1, west) : 0, east > -2 && east < 12 ? smoothstep(12, 1, east) : 0)
    h = lerp(h, BRIDGE_DECK - 0.1, ramp * bz)
  }
  // Sentiers légèrement tassés.
  h -= smoothstep(2.2, 0, pathDistance(x, z)) * 0.12
  // Remparts naturels en bordure de la zone jouable.
  h += smoothstep(PLAY_RADIUS - 10, PLAY_RADIUS + 22, Math.hypot(x, z)) * 18
  return h
}

// Pont de bois au-dessus de la rivière.
export const BRIDGE = { z: BRIDGE_Z, x0: BRIDGE_X0, x1: BRIDGE_X1, halfWidth: 1.6, deck: BRIDGE_DECK }

export function onBridge(x, z) {
  return Math.abs(z - BRIDGE.z) < BRIDGE.halfWidth && x > BRIDGE.x0 && x < BRIDGE.x1
}

// Hauteur de la surface où l'on marche (terrain ou pont).
export function surfaceHeight(x, z) {
  const g = groundHeight(x, z)
  return onBridge(x, z) ? Math.max(g, BRIDGE.deck) : g
}

// L'eau n'existe que dans le lit de la rivière.
export const nearRiver = (x, z) => Math.abs(x - riverX(z)) < RIVER_HALF_WIDTH + 6
export const inWater = (x, z) => nearRiver(x, z) && !onBridge(x, z) && groundHeight(x, z) < WATER_Y - 0.1

// Couleur du sol (RVB 0–1) selon le milieu, le relief et les sentiers.
const C = {
  grass: [0.4, 0.56, 0.26],
  grassDry: [0.56, 0.58, 0.3],
  forest: [0.16, 0.24, 0.1],
  litter: [0.27, 0.2, 0.11],
  soil: [0.62, 0.47, 0.3],
  path: [0.58, 0.43, 0.27],
  mud: [0.4, 0.33, 0.22],
  rock: [0.5, 0.48, 0.42],
}

export function groundColor(x, z, h) {
  const n = fbm(x * 3.1, z * 3.1)
  // Passage progressif de la lisière à la forêt (sans limite rectiligne).
  const dx = x - riverX(z)
  const wobble = Math.sin(x * 0.09) * 6 + Math.cos(z * 0.07) * 4
  const forest = Math.max(smoothstep(RIVER_HALF_WIDTH + 6, RIVER_HALF_WIDTH + 20, dx + wobble), smoothstep(-30, -48, z + wobble))
  const open = mix(C.grass, C.grassDry, smoothstep(0.6, 1.4, n))
  let c = mix(open, mix(C.forest, C.litter, smoothstep(0.7, 1.3, n)), forest)
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z)
  c = mix(c, C.soil, smoothstep(VILLAGE.r - 4, VILLAGE.r - 14, dv) * 0.85)
  if (h > 6) c = mix(c, C.rock, smoothstep(6, 11, h) * 0.5)
  if (Math.abs(dx) < RIVER_HALF_WIDTH + 6) c = mix(c, C.mud, smoothstep(0, -1.2, h))
  c = mix(c, C.path, smoothstep(2.4, 0.8, pathDistance(x, z)) * 0.9)
  const shade = 0.92 + n * 0.08
  return [c[0] * shade, c[1] * shade, c[2] * shade]
}

const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

// Masques du sol HD (textures photo) : [latérite des sentiers et du village,
// boue des berges, litière forestière]. Même logique que groundColor().
export function groundMasks(x, z, h) {
  const dx = x - riverX(z)
  const wobble = Math.sin(x * 0.09) * 6 + Math.cos(z * 0.07) * 4
  const forest = Math.max(smoothstep(RIVER_HALF_WIDTH + 6, RIVER_HALF_WIDTH + 20, dx + wobble), smoothstep(-30, -48, z + wobble))
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z)
  const soil = Math.max(smoothstep(VILLAGE.r - 4, VILLAGE.r - 14, dv) * 0.9, smoothstep(2.4, 0.8, pathDistance(x, z)))
  const mud = Math.abs(dx) < RIVER_HALF_WIDTH + 6 ? smoothstep(0.2, -1.2, h) : 0
  return [soil, mud, forest]
}
