import { POINTS } from '../../data/atlasContent.js'
import { ALL, atlasIds, LANDSCAPE_CATEGORIES, villageStations } from '../world/ituri/catalog.js'
import { getPlatform } from './platform.js'

// Moteur de missions : l'avancement de chaque étape se déduit de la
// progression du joueur (lieux visités, espèces découvertes, personnages
// rencontrés, espaces consultés, fiches lues, communautés rencontrées, quiz
// réussis). Une action déjà accomplie compte donc pour toutes les missions
// qui la demandent.
//
// Cibles qui suivent la plateforme (contenus présents et à venir) :
//   identify / discover : « atlas-<catégorie> » = toute fiche de l'atlas de
//                         cette catégorie (faune, flore, eaux, reliefs, barrages) ;
//   read                : « toutes », « categorie-<slug> » (toute la branche
//                         du référentiel), « communaute-<slug> » ;
//   community           : « toutes » ou le slug d'une communauté.

const BUCKET = { explore: 'zones', identify: 'discoveries', discover: 'discoveries', talk: 'talks', consult: 'consulted', read: 'reads', community: 'communities' }

const LANDSCAPE = new Set(POINTS.filter((p) => LANDSCAPE_CATEGORIES.includes(p.category)).map((p) => p.id))

// Cibles concrètes d'une étape (groupes de l'atlas développés).
function expand(targets) {
  const out = new Set()
  for (const t of targets) {
    if (t.startsWith('atlas-')) atlasIds(t.slice(6)).forEach((id) => out.add(id))
    else out.add(t)
  }
  return [...out]
}

function readMatches(entry, target) {
  if (target === ALL) return true
  if (target.startsWith('categorie-')) {
    const slug = target.slice(10)
    return entry.root === slug || entry.category === slug
  }
  if (target.startsWith('communaute-')) return (entry.communities ?? []).includes(target.slice(11))
  return false
}

// Éléments déjà accomplis qui comptent pour l'étape.
function achieved(step, state) {
  const bucket = state[BUCKET[step.type]] ?? {}
  if (step.type === 'read') return Object.values(bucket).filter((entry) => step.targets.some((t) => readMatches(entry, t)))
  if (step.type === 'community') return step.targets.includes(ALL) ? Object.keys(bucket) : step.targets.filter((id) => bucket[id])
  return expand(step.targets).filter((id) => bucket[id])
}

export function stepCount(step, state, mission) {
  if (step.type === 'quiz') return state.quizzes[`${mission.slug}:${step.id}`] ? 1 : 0
  return Math.min(step.count, achieved(step, state).length)
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

// Cibles encore à atteindre pour l'étape en cours (marqueurs sur la carte) :
// les fiches à lire mènent à l'espace de leur thème, les paysages à la
// longue-vue, les communautés à l'arbre à palabres.
export function pendingTargets(mission, state) {
  const step = currentStep(mission, state)
  if (!step) return []
  if (step.type === 'quiz') return step.targets
  if (step.type === 'community') return ['communautes']
  if (step.type === 'read') {
    const stations = villageStations(getPlatform().roots)
    return [
      ...new Set(
        step.targets.map((t) => {
          if (t.startsWith('categorie-')) return stations.find((s) => s.category === t.slice(10))?.id ?? 'savoirs'
          if (t.startsWith('communaute-')) return 'communautes'
          return 'savoirs'
        }),
      ),
    ]
  }
  const bucket = state[BUCKET[step.type]] ?? {}
  return [...new Set(expand(step.targets).filter((id) => !bucket[id]).map((id) => (LANDSCAPE.has(id) ? 'panorama' : id)))]
}

export const MODES = [
  { id: 'exploration', name: 'Exploration', available: true, hint: 'Parcourir librement les paysages, observer, ouvrir les fiches.' },
  { id: 'patrimoine', name: 'Patrimoine culturel', available: true, hint: 'Découvrir les savoirs documentés et publiés par les communautés.' },
  { id: 'nature', name: 'Nature et biodiversité', available: true, hint: 'Identifier les plantes, observer les animaux, comprendre leur protection.' },
  { id: 'histoire', name: 'Histoire et mémoire', available: false, hint: 'Archives et récits historiques validés : en préparation avec les historiens et les communautés.' },
  { id: 'defis', name: 'Défis et connaissances', available: true, hint: 'Quiz chronométrés et jeux d’identification à partir des fiches URITHI.' },
]
