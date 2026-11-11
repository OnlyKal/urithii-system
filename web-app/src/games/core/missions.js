// Moteur de missions : l'avancement de chaque étape se déduit de la
// progression du joueur (lieux visités, espèces découvertes, personnages
// rencontrés, espaces consultés, quiz réussis). Une action déjà accomplie
// compte donc pour toutes les missions qui la demandent.

const BUCKET = { explore: 'zones', identify: 'discoveries', discover: 'discoveries', talk: 'talks', consult: 'consulted' }

export function stepCount(step, state, mission) {
  if (step.type === 'quiz') return state.quizzes[`${mission.slug}:${step.id}`] ? 1 : 0
  const bucket = state[BUCKET[step.type]] ?? {}
  return Math.min(step.count, step.targets.filter((id) => bucket[id]).length)
}

export const stepDone = (step, state, mission) => stepCount(step, state, mission) >= (step.type === 'quiz' ? 1 : step.count)

// Étape en cours : la première non terminée.
export const currentStep = (mission, state) => mission.steps.find((step) => !stepDone(step, state, mission)) ?? null

export function missionProgress(mission, state) {
  const done = mission.steps.filter((s) => stepDone(s, state, mission)).length
  return { done, total: mission.steps.length, ratio: mission.steps.length ? done / mission.steps.length : 0 }
}

export function missionStatus(mission, state) {
  return state.missions[mission.slug]?.status ?? 'available'
}

// Cibles encore à atteindre pour l'étape en cours (marqueurs sur la carte).
export function pendingTargets(mission, state) {
  const step = currentStep(mission, state)
  if (!step) return []
  if (step.type === 'quiz') return step.targets
  const bucket = state[BUCKET[step.type]] ?? {}
  return step.targets.filter((id) => !bucket[id])
}

export const MODES = [
  { id: 'exploration', name: 'Exploration', available: true, hint: 'Parcourir librement les paysages, observer, ouvrir les fiches.' },
  { id: 'patrimoine', name: 'Patrimoine culturel', available: true, hint: 'Découvrir les savoirs documentés et publiés par les communautés.' },
  { id: 'nature', name: 'Nature et biodiversité', available: true, hint: 'Identifier les plantes, observer les animaux, comprendre leur protection.' },
  { id: 'histoire', name: 'Histoire et mémoire', available: false, hint: 'Archives et récits historiques validés : en préparation avec les historiens et les communautés.' },
  { id: 'defis', name: 'Défis et connaissances', available: true, hint: 'Quiz chronométrés et jeux d’identification à partir des fiches URITHI.' },
]
