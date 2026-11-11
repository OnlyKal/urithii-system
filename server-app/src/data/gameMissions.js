// Missions fournies avec le jeu « URITHI – Les Gardiens de l'Héritage ».
//
// Elles sont créées au démarrage du serveur si elles n'existent pas encore,
// puis modifiables (ou désactivables) depuis l'espace d'administration.
//
// Les cibles des étapes sont des identifiants de l'environnement 3D. Pour la
// faune et la flore, ce sont les identifiants des fiches de l'atlas vivant
// d'URITHI : le jeu affiche ces fiches, il ne rédige pas sa propre
// documentation. Chaque question de quiz cite la fiche qui fonde sa réponse.

export const GAME_MODES = ['exploration', 'patrimoine', 'nature', 'histoire', 'defis'];
export const STEP_TYPES = ['explore', 'identify', 'discover', 'talk', 'consult', 'quiz'];

export const DEFAULT_GAME_MISSIONS = [
  {
    slug: 'premiers-pas',
    title: 'Premiers pas dans l’Ituri',
    description:
      'Vous arrivez dans un village au bord d’une rivière, à la lisière de la grande forêt. Prenez vos repères avant de partir à l’aventure.',
    objective: 'Parcourir les quatre lieux remarquables de la zone.',
    mode: 'exploration',
    environment: 'ituri',
    rewardXp: 80,
    badge: 'explorateur-du-congo',
    position: 1,
    contentRefs: ['foret-ituri'],
    steps: [
      { id: 'village', type: 'explore', label: 'Faire le tour du village', targets: ['village'], count: 1 },
      { id: 'riviere', type: 'explore', label: 'Descendre jusqu’à la rivière', targets: ['riviere'], count: 1 },
      { id: 'foret', type: 'explore', label: 'Entrer dans la forêt', targets: ['foret'], count: 1 },
      { id: 'belvedere', type: 'explore', label: 'Monter au belvédère', targets: ['belvedere'], count: 1 },
    ],
  },
  {
    slug: 'secrets-de-la-foret',
    title: 'Les secrets de la forêt',
    description:
      'La forêt de l’Ituri abrite des arbres géants et des animaux que l’on ne trouve nulle part ailleurs. L’écogarde de la réserve a besoin de vous pour en dresser l’inventaire.',
    objective: 'Identifier trois arbres, observer un animal, écouter l’écogarde et répondre à ses questions.',
    mode: 'nature',
    environment: 'ituri',
    rewardXp: 200,
    badge: 'protecteur-des-forets',
    position: 2,
    contentRefs: ['foret-ituri', 'limbali', 'parasolier', 'fumbwa', 'palmier', 'okapi'],
    steps: [
      { id: 'explorer', type: 'explore', label: 'Explorer la forêt', targets: ['foret'], count: 1 },
      {
        id: 'plantes',
        type: 'identify',
        label: 'Identifier trois espèces végétales',
        targets: ['limbali', 'parasolier', 'fumbwa', 'palmier'],
        count: 3,
      },
      { id: 'animal', type: 'discover', label: 'Observer un animal', targets: ['okapi', 'elephant-foret', 'paon-congo'], count: 1 },
      { id: 'ecogarde', type: 'talk', label: 'Écouter l’histoire de l’écogarde', targets: ['ecogarde'], count: 1 },
      {
        id: 'quiz',
        type: 'quiz',
        label: 'Répondre aux questions de l’écogarde',
        targets: ['ecogarde'],
        count: 1,
        questions: [
          {
            q: 'Quel arbre forme des peuplements presque purs dans la forêt de l’Ituri ?',
            choices: ['Le limbali', 'Le palmier à huile', 'Le parasolier'],
            answer: 0,
            source: 'foret-ituri',
          },
          {
            q: 'En quelle année l’okapi a-t-il été décrit par la science ?',
            choices: ['1821', '1901', '1965'],
            answer: 1,
            source: 'okapi',
          },
          {
            q: 'Que signale la présence du parasolier ?',
            choices: ['Une forêt ancienne jamais perturbée', 'Une forêt qui se régénère après une ouverture', 'La proximité d’un lac'],
            answer: 1,
            source: 'parasolier',
          },
        ],
      },
    ],
  },
  {
    slug: 'gardiens-de-la-faune',
    title: 'Gardiens de la faune',
    description:
      'Trois espèces emblématiques vivent dans cette forêt. Discrètes, elles fuient le bruit : approchez-vous en marchant pour les observer.',
    objective: 'Observer l’okapi, l’éléphant de forêt et le paon du Congo, puis répondre au quiz.',
    mode: 'nature',
    environment: 'ituri',
    rewardXp: 220,
    badge: 'gardien-de-la-biodiversite',
    position: 3,
    contentRefs: ['okapi', 'elephant-foret', 'paon-congo'],
    steps: [
      { id: 'faune', type: 'discover', label: 'Observer les trois espèces', targets: ['okapi', 'elephant-foret', 'paon-congo'], count: 3 },
      {
        id: 'quiz',
        type: 'quiz',
        label: 'Quiz de l’écogarde',
        targets: ['ecogarde'],
        count: 1,
        questions: [
          {
            q: 'Pourquoi dit-on de l’éléphant de forêt qu’il est le « jardinier de la forêt » ?',
            choices: ['Il creuse des mares', 'Il disperse les graines des arbres', 'Il taille les branches basses'],
            answer: 1,
            source: 'elephant-foret',
          },
          {
            q: 'Le paon du Congo est…',
            choices: ['Le seul paon d’Afrique', 'Un oiseau migrateur venu d’Asie', 'Un oiseau des savanes'],
            answer: 0,
            source: 'paon-congo',
          },
          {
            q: 'Quel est le statut de conservation de l’éléphant de forêt sur la liste rouge de l’UICN ?',
            choices: ['Préoccupation mineure', 'Vulnérable', 'En danger critique'],
            answer: 2,
            source: 'elephant-foret',
          },
        ],
      },
    ],
  },
  {
    slug: 'savoirs-du-village',
    title: 'Les savoirs du village',
    description:
      'Le guide du village vous présente les fiches culturelles documentées et publiées dans URITHI : gastronomie, vêtements, langues, mémoire collective.',
    objective: 'Rencontrer le guide puis consulter trois espaces du village.',
    mode: 'patrimoine',
    environment: 'ituri',
    rewardXp: 150,
    badge: 'ambassadeur-des-traditions',
    position: 4,
    contentRefs: [],
    steps: [
      { id: 'guide', type: 'talk', label: 'Rencontrer le guide du village', targets: ['guide-village'], count: 1 },
      {
        id: 'espaces',
        type: 'consult',
        label: 'Consulter trois espaces du village',
        targets: ['cuisine', 'habits', 'memoire', 'langues', 'artisanat'],
        count: 3,
      },
    ],
  },
];

// Crée les missions fournies qui n'existent pas encore (jamais d'écrasement :
// les modifications de l'administration sont conservées).
export async function ensureGameMissions(prisma) {
  for (const mission of DEFAULT_GAME_MISSIONS) {
    const exists = await prisma.gameMission.findUnique({ where: { slug: mission.slug }, select: { id: true } });
    if (exists) continue;
    await prisma.gameMission.create({
      data: {
        ...mission,
        steps: JSON.stringify(mission.steps),
        contentRefs: JSON.stringify(mission.contentRefs),
        status: 'PUBLISHED',
        builtin: true,
      },
    });
  }
}
