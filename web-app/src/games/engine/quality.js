// Niveau de qualité graphique adapté à l'appareil, modifiable par le joueur.

export const QUALITY = {
  low: { label: 'Économie', dpr: [0.7, 1], shadows: false, shadowSize: 0, density: 0.45, terrain: 96, far: 150 },
  medium: { label: 'Équilibrée', dpr: [1, 1.5], shadows: true, shadowSize: 1024, density: 0.75, terrain: 128, far: 200 },
  high: { label: 'Haute (modèles réalistes, ~25 Mo)', dpr: [1, 2], shadows: true, shadowSize: 2048, density: 1, terrain: 176, far: 240 },
}

export function detectQuality() {
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  const memory = navigator.deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  if (touch || memory <= 2 || cores <= 2) return 'low'
  if (memory >= 8 && cores >= 8) return 'high'
  return 'medium'
}

export const resolveQuality = (setting) => (QUALITY[setting] ? setting : detectQuality())
