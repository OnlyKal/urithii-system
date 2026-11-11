import { t } from '../../i18n/index.js'

// Étapes du circuit de validation et permissions qui permettent d'y agir
// (voir server-app/src/services/workflow.js).
export const REVIEW_STEPS = [
  ['SUBMITTED', ['content.edit']],
  ['IN_TRANSCRIPTION', ['transcription.edit', 'content.edit']],
  ['IN_TRANSLATION', ['translation.edit', 'content.edit']],
  ['IN_DOCUMENT_REVIEW', ['content.edit']],
  ['IN_CULTURAL_REVIEW', ['content.validate_cultural']],
  ['IN_EDITORIAL_REVIEW', ['content.validate_editorial']],
  ['AWAITING_AUTHORIZATION', ['content.edit']],
  ['VALIDATED', ['content.publish']],
  ['SCHEDULED', ['content.publish']],
]

export const REVIEW_PERMISSIONS = [...new Set(REVIEW_STEPS.flatMap(([, perms]) => perms))]

// Statuts où l'utilisateur peut agir dans le circuit de validation.
export const actionableStatuses = (can) => REVIEW_STEPS.filter(([, perms]) => perms.some(can)).map(([status]) => status)

const PENDING = REVIEW_STEPS.map(([status]) => status)

// Files de travail de l'espace « Contenus » : chaque vue regroupe des statuts.
export function contentViews(can) {
  const toAct = actionableStatuses(can)
  return [
    ...(toAct.length ? [{ id: 'a-traiter', label: t('ws.aTraiter'), statuses: toAct }] : []),
    { id: 'brouillons', label: t('ws.brouillons'), statuses: ['DRAFT', 'IN_PREPARATION'] },
    { id: 'corrections', label: t('ws.correctionsDemandees'), statuses: ['NEEDS_COMPLETION', 'UNDER_REVISION'] },
    { id: 'en-validation', label: t('ws.enValidation'), statuses: PENDING },
    { id: 'publies', label: t('ws.publies'), statuses: ['PUBLISHED'] },
    { id: 'retires', label: t('ws.suspendusEtArchives'), statuses: ['SUSPENDED', 'WITHDRAWN', 'ARCHIVED'] },
    { id: 'tous', label: t('ws.tous'), statuses: [] },
  ]
}

export const countFor = (byStatus, statuses) =>
  statuses.length ? statuses.reduce((sum, s) => sum + (byStatus?.[s] ?? 0), 0) : Object.values(byStatus ?? {}).reduce((a, b) => a + b, 0)

// Libellé de l'action qui fait passer une fiche au statut indiqué.
export const ACTION_LABELS = {
  DRAFT: t('ws.action.DRAFT'),
  IN_PREPARATION: t('ws.action.IN_PREPARATION'),
  SUBMITTED: t('ws.action.SUBMITTED'),
  NEEDS_COMPLETION: t('ws.action.NEEDS_COMPLETION'),
  IN_TRANSCRIPTION: t('ws.action.IN_TRANSCRIPTION'),
  IN_TRANSLATION: t('ws.action.IN_TRANSLATION'),
  IN_DOCUMENT_REVIEW: t('ws.action.IN_DOCUMENT_REVIEW'),
  IN_CULTURAL_REVIEW: t('ws.action.IN_CULTURAL_REVIEW'),
  IN_EDITORIAL_REVIEW: t('ws.action.IN_EDITORIAL_REVIEW'),
  AWAITING_AUTHORIZATION: t('ws.action.AWAITING_AUTHORIZATION'),
  VALIDATED: t('ws.action.VALIDATED'),
  PUBLISHED: t('ws.action.PUBLISHED'),
  SCHEDULED: t('ws.action.SCHEDULED'),
  UNDER_REVISION: t('ws.action.UNDER_REVISION'),
  SUSPENDED: t('ws.action.SUSPENDED'),
  WITHDRAWN: t('ws.action.WITHDRAWN'),
  ARCHIVED: t('ws.action.ARCHIVED'),
}

// Actions qui font reculer ou retirer une fiche : présentées en retrait.
export const BACKWARD_ACTIONS = new Set(['DRAFT', 'NEEDS_COMPLETION', 'AWAITING_AUTHORIZATION', 'UNDER_REVISION', 'SUSPENDED', 'WITHDRAWN', 'ARCHIVED'])

// Ordre d'avancement dans le circuit : l'action qui fait le plus avancer
// la fiche est mise en avant.
const PROGRESS = ['DRAFT', 'IN_PREPARATION', 'SUBMITTED', 'IN_TRANSCRIPTION', 'IN_TRANSLATION', 'IN_DOCUMENT_REVIEW', 'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW', 'VALIDATED', 'SCHEDULED', 'PUBLISHED']

export function primaryAction(transitions) {
  const forward = transitions.filter((tx) => !BACKWARD_ACTIONS.has(tx.status) && !tx.blockedReason && PROGRESS.includes(tx.status))
  return forward.sort((a, b) => PROGRESS.indexOf(b.status) - PROGRESS.indexOf(a.status))[0]?.status ?? null
}

// Statuts dans lesquels l'auteur prépare encore sa fiche.
export const EDITABLE_BY_AUTHOR = ['DRAFT', 'IN_PREPARATION', 'NEEDS_COMPLETION']

// Étapes du parcours de documentation, communes à l'éditeur et au dossier.
export const EDITOR_STEPS = [
  { key: 'communaute', label: t('ws.etape.communaute') },
  { key: 'infos', label: t('ws.etape.infos') },
  { key: 'sources', label: t('ws.etape.sources') },
  { key: 'diffusion', label: t('ws.etape.diffusion') },
  { key: 'verifier', label: t('ws.etape.verifier') },
]

// Contrôles de complétude d'une fiche (formulaire ou fiche enregistrée).
// level : 'submit' (nécessaire pour soumettre), 'publish' (exigé à la
// publication, voir publicationProblems côté serveur) ou 'recommended'.
// Ni consentement, ni personne ressource, ni source ne sont exigés : une
// source ou un témoin reste recommandé.
export function completenessChecks(f) {
  const hasSource = f.sources.length > 0
  const hasWitness = Boolean(f.resourcePersonId)
  return [
    { key: 'title', step: 'infos', ok: Boolean(f.title?.trim() && f.categoryId), level: 'submit', label: t('ws.check.titre') },
    { key: 'community', step: 'communaute', ok: f.communityIds.length > 0, level: 'submit', label: t('ws.check.communaute') },
    { key: 'summary', step: 'infos', ok: Boolean(f.summary?.trim()), level: 'submit', label: t('ws.check.resume') },
    { key: 'body', step: 'infos', ok: Boolean(f.body?.trim()), level: 'recommended', label: t('ws.check.description') },
    { key: 'source', step: 'sources', ok: hasSource || hasWitness, level: 'recommended', label: t('ws.check.source') },
    {
      key: 'verification',
      step: 'sources',
      ok: !['SOURCED', 'CORROBORATED'].includes(f.verificationStatus) || hasSource,
      level: 'submit',
      label: t('ws.check.verification'),
    },
    { key: 'media', step: 'sources', ok: f.media.length > 0, level: 'recommended', label: t('ws.check.medias') },
    { key: 'access', step: 'diffusion', ok: f.accessLevel === 'PUBLIC', level: 'publish', label: t('ws.check.acces') },
  ].map((c) => ({ ...c, blocking: c.level === 'submit' }))
}

export const LEVEL_LABELS = {
  submit: t('ws.requisPourSoumettre'),
  publish: t('ws.requisPourPublier'),
  recommended: t('ws.recommande'),
}

// Même forme que le formulaire d'édition, à partir d'une fiche enregistrée.
export const itemToChecks = (item) =>
  completenessChecks({
    ...item,
    communityIds: item.communities,
  })
