import { Award, BookOpenCheck, Compass, Crown, Footprints, HandHeart, Landmark, Leaf, PawPrint, Sparkles, Target, Timer, TreePine, Trophy } from 'lucide-react'

// Badges (gagnés en terminant une mission) et trophées (exploits calculés à
// partir de la progression).

export const BADGES = [
  { id: 'explorateur-du-congo', name: 'Explorateur du Congo', icon: Compass, color: '#29cb94', hint: 'Parcourir les lieux remarquables d’un environnement.' },
  { id: 'protecteur-des-forets', name: 'Protecteur des forêts', icon: TreePine, color: '#2f6c4b', hint: 'Percer les secrets de la forêt.' },
  { id: 'gardien-de-la-biodiversite', name: 'Gardien de la biodiversité', icon: PawPrint, color: '#c27a12', hint: 'Observer la faune emblématique.' },
  { id: 'ambassadeur-des-traditions', name: 'Ambassadeur des traditions', icon: HandHeart, color: '#ffb547', hint: 'Découvrir les savoirs documentés du village.' },
  { id: 'historien-de-l-heritage', name: 'Historien de l’héritage', icon: Landmark, color: '#3f5ca6', hint: 'Mode Histoire et mémoire : à venir.' },
]

export const badgeInfo = (id) => BADGES.find((b) => b.id === id) ?? { id, name: id, icon: Award, color: '#3f5ca6', hint: '' }

export const TROPHIES = [
  { id: 'premiere-decouverte', name: 'Première découverte', icon: Sparkles, hint: 'Ouvrir sa première fiche.', test: (s) => Object.keys(s.discoveries).length >= 1 },
  { id: 'naturaliste', name: 'Naturaliste', icon: Leaf, hint: 'Identifier les quatre plantes de la lisière de l’Ituri.', test: (s) => ['palmier', 'parasolier', 'limbali', 'fumbwa'].every((id) => s.discoveries[id]) },
  { id: 'pisteur', name: 'Pisteur', icon: PawPrint, hint: 'Observer les trois animaux de la forêt.', test: (s) => ['okapi', 'elephant-foret', 'paon-congo'].every((id) => s.discoveries[id]) },
  { id: 'sans-faute', name: 'Sans faute', icon: Target, hint: 'Réussir un quiz sans aucune erreur.', test: (s) => s.stats.perfectQuizzes > 0 },
  { id: 'randonneur', name: 'Randonneur', icon: Footprints, hint: 'Parcourir 1 km à pied.', test: (s) => s.stats.distance >= 1000 },
  { id: 'defi-eclair', name: 'Éclair', icon: Timer, hint: 'Obtenir 8 bonnes réponses au défi éclair.', test: (s) => s.stats.challengeBest >= 8 },
  { id: 'erudit', name: 'Érudit', icon: BookOpenCheck, hint: 'Consulter cinq espaces culturels du village.', test: (s) => Object.keys(s.consulted).length >= 5 },
  { id: 'gardien-accompli', name: 'Gardien accompli', icon: Crown, hint: 'Obtenir quatre badges.', test: (s) => Object.keys(s.badges).length >= 4 },
]

export const earnedTrophies = (state) => TROPHIES.filter((t) => t.test(state)).map((t) => t.id)

// Niveaux : chaque niveau demande 100 XP de plus que le précédent.
export function levelFor(xp) {
  let level = 1
  let need = 100
  let floor = 0
  while (xp >= floor + need) {
    floor += need
    level += 1
    need = 100 * level
  }
  return { level, into: xp - floor, need, title: TITLES[Math.min(level, TITLES.length) - 1] }
}

const TITLES = ['Apprenti gardien', 'Éclaireur', 'Pisteur', 'Gardien', 'Gardien confirmé', 'Grand gardien']

// Points d'expérience attribués par action.
export const XP = { zone: 10, identify: 25, discover: 40, talk: 15, consult: 20, quizCorrect: 15 }

export { Trophy }
