import { NPCS, PLAY_RADIUS, STATIONS, SUBJECTS, ZONE_CENTERS } from '../world/ituri/catalog.js'
import { HUTS } from '../world/ituri/layout.js'
import { groundColor, groundHeight, nearRiver, WATER_Y } from '../world/ituri/terrain.js'

// Carte d'exploration dessinée à partir du relief réel de l'environnement.

const EXTENT = PLAY_RADIUS + 8
let base = null

// Fond de carte (calculé une fois) : couleurs du sol, eau, ombrage du relief.
function baseMap() {
  if (base) return base
  const size = 192
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / size) * 2 * EXTENT - EXTENT
      const z = (j / size) * 2 * EXTENT - EXTENT
      const h = groundHeight(x, z)
      let [r, g, b] = groundColor(x, z, h)
      if (h < WATER_Y && nearRiver(x, z)) [r, g, b] = [0.27, 0.53, 0.6]
      const shade = 1 + (groundHeight(x - 1.5, z - 1.5) - h) * 0.12
      const out = Math.hypot(x, z) > PLAY_RADIUS ? 0.55 : 1
      const k = (j * size + i) * 4
      image.data[k] = Math.min(255, r * 255 * shade * out)
      image.data[k + 1] = Math.min(255, g * 255 * shade * out)
      image.data[k + 2] = Math.min(255, b * 255 * shade * out)
      image.data[k + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  base = canvas
  return base
}

export const ZONE_POSITIONS = ZONE_CENTERS

// Position d'une cible de mission (zone, espèce, personnage, espace).
export function targetPosition(id, runtime) {
  const live = runtime?.interactables.get(id)
  if (live) return live.getPosition()
  return ZONE_CENTERS[id] ?? SUBJECTS.find((s) => s.id === id) ?? NPCS.find((n) => n.id === id) ?? STATIONS.find((s) => s.id === id) ?? null
}

// Dessine la carte. « view » : { cx, cz, radius } (mini-carte centrée sur le
// joueur) ou null (carte entière).
export function drawMap(ctx, size, { runtime, targets = [], discovered = {}, view = null, labels = false }) {
  const cx = view?.cx ?? 0
  const cz = view?.cz ?? 0
  const radius = view?.radius ?? EXTENT
  const scale = size / (radius * 2)
  const sx = (x) => (x - cx + radius) * scale
  const sz = (z) => (z - cz + radius) * scale
  ctx.clearRect(0, 0, size, size)
  const map = baseMap()
  const k = map.width / (EXTENT * 2)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(map, (cx - radius + EXTENT) * k, (cz - radius + EXTENT) * k, radius * 2 * k, radius * 2 * k, 0, 0, size, size)

  // Habitations.
  ctx.fillStyle = 'rgba(120, 82, 45, 0.9)'
  for (const h of HUTS) {
    ctx.beginPath()
    ctx.arc(sx(h.x), sz(h.z), Math.max(2, 3 * scale), 0, Math.PI * 2)
    ctx.fill()
  }
  // Espaces culturels et personnages.
  for (const s of STATIONS) dot(ctx, sx(s.x), sz(s.z), discovered[s.id] ? '#c8c2b8' : '#ffb547', 3.2)
  for (const n of NPCS) dot(ctx, sx(n.x), sz(n.z), '#ffffff', 3.6, '#1e3a8a')
  // Espèces déjà découvertes.
  for (const s of SUBJECTS) {
    if (!discovered[s.id]) continue
    const p = targetPosition(s.id, runtime)
    dot(ctx, sx(p.x), sz(p.z), s.kind === 'animal' ? '#c27a12' : '#2f6c4b', 3)
  }
  // Cibles de la mission en cours.
  const t = performance.now() / 1000
  for (const id of targets) {
    const p = targetPosition(id, runtime)
    if (!p) continue
    let x = sx(p.x)
    let y = sz(p.z)
    const inside = x >= 6 && x <= size - 6 && y >= 6 && y <= size - 6
    if (!inside) {
      // Cible hors de la mini-carte : flèche au bord.
      const a = Math.atan2(y - size / 2, x - size / 2)
      x = size / 2 + Math.cos(a) * (size / 2 - 8)
      y = size / 2 + Math.sin(a) * (size / 2 - 8)
    }
    ctx.beginPath()
    ctx.arc(x, y, 5 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(41, 203, 148, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    dot(ctx, x, y, '#29cb94', 3.4, '#ffffff')
  }
  if (labels) {
    ctx.font = '600 13px Inter Variable, system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const [id, name] of [['village', 'Village'], ['riviere', 'Rivière'], ['foret', 'Forêt'], ['belvedere', 'Belvédère']]) {
      const p = ZONE_CENTERS[id]
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
      ctx.fillText(name, sx(p.x) + 1, sz(p.z) - 13)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(name, sx(p.x), sz(p.z) - 14)
    }
  }
  // Joueur : flèche orientée.
  const p = runtime.player
  ctx.save()
  ctx.translate(sx(p.pos.x), sz(p.pos.z))
  ctx.rotate(-p.ry + Math.PI)
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(6, 6)
  ctx.lineTo(0, 3)
  ctx.lineTo(-6, 6)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#1e3a8a'
  ctx.lineWidth = 2
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function dot(ctx, x, y, fill, r, stroke = 'rgba(15, 23, 42, 0.5)') {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = stroke
  ctx.stroke()
}
