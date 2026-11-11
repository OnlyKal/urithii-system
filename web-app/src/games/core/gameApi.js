import { api } from '../../api.js'

// Services du module Jeux.

let missionsPromise = null
export function fetchMissions() {
  missionsPromise ??= api('/public/games/missions')
    .then((r) => r.missions)
    .catch((error) => {
      missionsPromise = null
      throw error
    })
  return missionsPromise
}

// Statistiques anonymes : un compteur par événement, sans identifiant.
export function sendEvent(event, mission) {
  try {
    fetch('/api/public/games/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mission ? { event, mission } : { event }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Statistiques facultatives.
  }
}
