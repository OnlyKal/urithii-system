import { useSyncExternalStore } from 'react'
import { earnedTrophies, levelFor, XP } from './rewards.js'
import { stepDone } from './missions.js'
import { sendEvent } from './gameApi.js'

// Progression du joueur, sauvegardée automatiquement dans le navigateur
// (aucun compte requis, aucune donnée personnelle envoyée au serveur).

const KEY = 'urithi.jeux.gardiens.v1'

const fresh = () => ({
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  profile: { name: '', color: '#29cb94' },
  xp: 0,
  activeMission: null,
  missions: {},
  zones: {},
  discoveries: {},
  talks: {},
  consulted: {},
  inventory: [],
  badges: {},
  trophies: {},
  quizzes: {},
  log: [],
  player: null,
  stats: { playSeconds: 0, distance: 0, quizAnswered: 0, quizCorrect: 0, perfectQuizzes: 0, sessions: 0, challengeBest: 0, challengePlays: 0 },
  settings: { quality: 'auto', music: true, sound: true },
})

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved?.version === 1) {
      const base = fresh()
      return { ...base, ...saved, stats: { ...base.stats, ...saved.stats }, settings: { ...base.settings, ...saved.settings } }
    }
  } catch {
    // Sauvegarde illisible ou stockage indisponible : nouvelle partie.
  }
  return null
}

let state = load() ?? fresh()
let saved = Boolean(load())
const listeners = new Set()
// Notifications (récompenses, découvertes) consommées par l'interface.
const notices = new Set()

let timer = 0
function persist() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
      saved = true
    } catch {
      // Stockage plein ou désactivé : la partie continue sans sauvegarde.
    }
  }, 400)
}

function set(next) {
  state = { ...next, updatedAt: new Date().toISOString() }
  persist()
  listeners.forEach((l) => l())
}

export const getProgress = () => state
export const hasSave = () => saved && (state.xp > 0 || Object.keys(state.zones).length > 0)
export const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))
export const useProgress = () => useSyncExternalStore(subscribe, getProgress)

export const onNotice = (fn) => (notices.add(fn), () => notices.delete(fn))
const notify = (notice) => notices.forEach((fn) => fn(notice))

export function newGame(profile) {
  const base = fresh()
  set({ ...base, profile: { ...base.profile, ...profile }, settings: state.settings })
}

export function updateProfile(profile) {
  set({ ...state, profile: { ...state.profile, ...profile } })
}

export function updateSettings(settings) {
  set({ ...state, settings: { ...state.settings, ...settings } })
}

export function savePlayer(player, extra = {}) {
  // Position et statistiques : sauvegarde silencieuse, sans rafraîchir l'interface.
  state = {
    ...state,
    player,
    stats: { ...state.stats, playSeconds: state.stats.playSeconds + (extra.seconds ?? 0), distance: state.stats.distance + (extra.distance ?? 0) },
  }
  persist()
}

export function startSession() {
  set({ ...state, stats: { ...state.stats, sessions: state.stats.sessions + 1 } })
  sendEvent('session')
}

const addLog = (s, entry) => ({ ...s, log: [{ ...entry, at: new Date().toISOString() }, ...s.log].slice(0, 80) })

// Enregistre une action du joueur, attribue l'expérience, puis vérifie les
// missions et les trophées.
//   { type: 'zone'|'identify'|'discover'|'talk'|'consult', id, name, kind }
export function record(event, missions = []) {
  const bucket = { zone: 'zones', identify: 'discoveries', discover: 'discoveries', talk: 'talks', consult: 'consulted' }[event.type]
  if (!bucket || state[bucket][event.id]) return false
  let next = { ...state, [bucket]: { ...state[bucket], [event.id]: new Date().toISOString() } }
  const gained = XP[event.type] ?? 0
  next.xp += gained
  if (event.type === 'identify' || event.type === 'discover') {
    next.inventory = [...next.inventory, { id: event.id, kind: event.type === 'identify' ? 'plante' : 'animal', name: event.name, at: new Date().toISOString() }]
    next = addLog(next, { type: event.type, id: event.id, name: event.name })
    sendEvent('discovery', undefined)
  } else if (event.type === 'consult') {
    next.inventory = [...next.inventory, { id: event.id, kind: 'savoir', name: event.name, at: new Date().toISOString() }]
    next = addLog(next, { type: event.type, id: event.id, name: event.name })
  }
  if (gained) notify({ type: 'xp', amount: gained, label: event.name })
  finish(next, missions)
  return true
}

export function recordQuiz(missionSlug, stepId, correct, total) {
  let next = {
    ...state,
    quizzes: { ...state.quizzes, [`${missionSlug}:${stepId}`]: { correct, total, at: new Date().toISOString() } },
    xp: state.xp + correct * XP.quizCorrect,
    stats: {
      ...state.stats,
      quizAnswered: state.stats.quizAnswered + total,
      quizCorrect: state.stats.quizCorrect + correct,
      perfectQuizzes: state.stats.perfectQuizzes + (correct === total ? 1 : 0),
    },
  }
  if (correct === total) sendEvent('quiz_perfect', missionSlug)
  return next
}

export function completeQuiz(missionSlug, stepId, correct, total, missions) {
  finish(recordQuiz(missionSlug, stepId, correct, total), missions)
}

export function recordChallenge(score) {
  const next = { ...state, xp: state.xp + score * 5, stats: { ...state.stats, challengeBest: Math.max(state.stats.challengeBest, score), challengePlays: state.stats.challengePlays + 1 } }
  sendEvent('challenge')
  finish(next, [])
}

export function startMission(mission) {
  const current = state.missions[mission.slug]
  if (current?.status === 'done') return set({ ...state, activeMission: mission.slug })
  const missions = current ? state.missions : { ...state.missions, [mission.slug]: { status: 'active', startedAt: new Date().toISOString() } }
  if (!current) sendEvent('mission_start', mission.slug)
  finish({ ...state, missions, activeMission: mission.slug }, [mission])
}

// Missions terminées, badges, trophées et niveau : vérifiés après chaque action.
function finish(next, missions) {
  const before = levelFor(state.xp).level
  for (const mission of missions) {
    const m = next.missions[mission.slug]
    if (m?.status !== 'active') continue
    if (!mission.steps.every((step) => stepDone(step, next, mission))) continue
    next = {
      ...next,
      xp: next.xp + mission.rewardXp,
      missions: { ...next.missions, [mission.slug]: { ...m, status: 'done', doneAt: new Date().toISOString() } },
    }
    if (mission.badge && !next.badges[mission.badge]) next.badges = { ...next.badges, [mission.badge]: new Date().toISOString() }
    next = addLog(next, { type: 'mission', id: mission.slug, name: mission.title })
    sendEvent('mission_complete', mission.slug)
    notify({ type: 'mission', mission, badge: mission.badge, xp: mission.rewardXp })
    // La mission suivante non terminée prend le relais.
    if (next.activeMission === mission.slug) {
      const following = missions.find((m) => next.missions[m.slug]?.status !== 'done')
      next.activeMission = following?.slug ?? null
      if (following && !next.missions[following.slug]) {
        next.missions = { ...next.missions, [following.slug]: { status: 'active', startedAt: new Date().toISOString() } }
        sendEvent('mission_start', following.slug)
      }
    }
  }
  for (const id of earnedTrophies(next)) {
    if (next.trophies[id]) continue
    next.trophies = { ...next.trophies, [id]: new Date().toISOString() }
    notify({ type: 'trophy', id })
  }
  const after = levelFor(next.xp).level
  if (after > before) notify({ type: 'level', level: after })
  set(next)
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Rien à effacer.
  }
  saved = false
  set(fresh())
}
