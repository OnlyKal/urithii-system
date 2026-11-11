import { getLanguage, t } from '../../../i18n/index.js'
import SECTION_TRANSLATIONS from '../../../i18n/sections.js'

// Statuts d'un dossier de collecte (voir server-app/src/services/dossiers.js).
export const DOSSIER_STATUS_LABELS = {
  DRAFT: t('dossier.status.DRAFT'),
  IN_PROGRESS: t('dossier.status.IN_PROGRESS'),
  SUBMITTED: t('dossier.status.SUBMITTED'),
  UNDER_REVIEW: t('dossier.status.UNDER_REVIEW'),
  CHANGES_REQUESTED: t('dossier.status.CHANGES_REQUESTED'),
  VALIDATED: t('dossier.status.VALIDATED'),
  PUBLISHED: t('dossier.status.PUBLISHED'),
  ARCHIVED: t('dossier.status.ARCHIVED'),
}

export const DOSSIER_ACTION_LABELS = {
  SUBMITTED: t('dossier.action.SUBMITTED'),
  UNDER_REVIEW: t('dossier.action.UNDER_REVIEW'),
  CHANGES_REQUESTED: t('dossier.action.CHANGES_REQUESTED'),
  VALIDATED: t('dossier.action.VALIDATED'),
  ARCHIVED: t('dossier.action.ARCHIVED'),
  DRAFT: t('dossier.action.DRAFT'),
}

export const REVIEW_LABELS = {
  PENDING: t('dossier.review.PENDING'),
  APPROVED: t('dossier.review.APPROVED'),
  CHANGES_REQUESTED: t('dossier.review.CHANGES_REQUESTED'),
  REJECTED: t('dossier.review.REJECTED'),
}

export const FIELD_STATUS_LABELS = {
  UNKNOWN: t('dossier.fieldStatus.UNKNOWN'),
  UNDOCUMENTED: t('dossier.fieldStatus.UNDOCUMENTED'),
  TO_CONFIRM: t('dossier.fieldStatus.TO_CONFIRM'),
}

export const COLLECTOR_EDITABLE = ['DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED']
export const CONTENT_KINDS = ['standard', 'identification', 'authorities']

// Files de la page « Collectes ».
export const DOSSIER_VIEWS = [
  { id: 'en-cours', label: t('dossier.view.enCours'), statuses: ['DRAFT', 'IN_PROGRESS'] },
  { id: 'corrections', label: t('dossier.view.corrections'), statuses: ['CHANGES_REQUESTED'] },
  { id: 'soumis', label: t('dossier.view.soumis'), statuses: ['SUBMITTED', 'UNDER_REVIEW'] },
  { id: 'valides', label: t('dossier.view.valides'), statuses: ['VALIDATED'] },
  { id: 'publies', label: t('dossier.view.publies'), statuses: ['PUBLISHED'] },
  { id: 'archives', label: t('dossier.view.archives'), statuses: ['ARCHIVED'] },
  { id: 'tous', label: t('ws.tous'), statuses: [] },
]

// Libellés des étapes : traduction du texte enregistré s'il est connu (les
// étapes de référence sont traduites), sinon le texte tel quel.
// `def` et `path` sont conservés pour des traductions propres à une étape.
export function tDef(def, path, fallback) {
  if (!fallback) return fallback
  return SECTION_TRANSLATIONS[getLanguage()]?.[fallback] ?? fallback
}
export const defTitle = (def) => tDef(def, 'title', def.title)
export const fieldLabel = (def, field, inEntry = false) => tDef(def, `${inEntry ? 'entry.' : ''}field.${field.key}`, field.label)
export const fieldHelp = (def, field, inEntry = false) => field.help && tDef(def, `${inEntry ? 'entry.' : ''}help.${field.key}`, field.help)
export const optionLabel = (def, option) => tDef(def, `option.${option}`, option)

// Une ligne structurée (lien, événement) compte si l'une de ses valeurs est saisie.
const filledPart = (x) => (x && typeof x === 'object' ? Object.values(x).some((y) => String(y ?? '').trim()) : Boolean(String(x ?? '').trim()))
export const isFilled = (v) => (Array.isArray(v) ? v.some(filledPart) : Boolean(String(v ?? '').trim()))

export const emptySection = () => ({ values: {}, fieldStatus: {}, entries: [], media: [], sources: [] })
export const newEntryId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Avancement d'une étape (même règle que le serveur, services/dossierSchema.js).
export function sectionCompletion(def, section = {}) {
  if (!CONTENT_KINDS.includes(def.kind) && def.kind !== 'testimonies') return null
  const fields = def.kind === 'testimonies' ? [] : def.fields
  const total = fields.length + (def.entry ? 1 : 0)
  if (!total) return null
  if (section.notDocumented) return { done: total, total }
  const values = section.values ?? {}
  const status = section.fieldStatus ?? {}
  let done = fields.filter((field) => isFilled(values[field.key]) || status[field.key]).length
  if (def.entry && (section.entries ?? []).length) done += 1
  return { done, total }
}

export function sectionState(def, section) {
  const c = sectionCompletion(def, section)
  if (!c) return 'neutral'
  if (section?.notDocumented) return 'not-documented'
  if (c.done === 0) return 'empty'
  return c.done >= c.total ? 'complete' : 'partial'
}

export function dossierProgress(defs, data) {
  let done = 0
  let total = 0
  for (const def of defs) {
    const c = sectionCompletion(def, data.sections?.[def.key])
    if (!c) continue
    done += c.done
    total += c.total
  }
  return total ? Math.round((done / total) * 100) : 0
}

export function sectionHasContent(section = {}) {
  return (
    Object.values(section.values ?? {}).some(isFilled) ||
    (section.entries ?? []).length > 0 ||
    (section.media ?? []).length > 0 ||
    (section.sources ?? []).length > 0
  )
}

// Points à vérifier avant la soumission.
export function submissionProblems(defs, dossier, data) {
  const problems = []
  if (!dossier.communityId && !dossier.proposedCommunityName) problems.push({ message: t('dossier.problem.community') })
  const contentDefs = defs.filter((d) => CONTENT_KINDS.includes(d.kind) || d.kind === 'testimonies')
  if (!contentDefs.some((d) => sectionHasContent(data.sections[d.key]))) problems.push({ message: t('dossier.problem.empty') })
  for (const def of defs) {
    const titleField = def.entry?.titleField
    if (!titleField) continue
    ;(data.sections[def.key]?.entries ?? []).forEach((entry, i) => {
      if (!isFilled(entry.values?.[titleField])) problems.push({ step: def.key, message: t('dossier.problem.entryTitle', { section: defTitle(def), n: i + 1 }) })
    })
  }
  return problems
}

// Points d'attention (non bloquants) : informations à confirmer, contenus
// sensibles.
export function attentionPoints(defs, data) {
  const points = []
  for (const def of defs) {
    const section = data.sections[def.key]
    if (!section) continue
    const toConfirm = Object.entries(section.fieldStatus ?? {}).filter(([, s]) => s === 'TO_CONFIRM').map(([k]) => k)
    for (const key of toConfirm) {
      const field = def.fields.find((f) => f.key === key)
      if (field) points.push({ step: def.key, kind: 'confirm', message: `${defTitle(def)} — ${fieldLabel(def, field)}` })
    }
    if (section.sensitive) points.push({ step: def.key, kind: 'sensitive', message: defTitle(def) })
    for (const entry of section.entries ?? []) {
      const title = entry.values?.[def.entry?.titleField] || '—'
      if (entry.sensitive) points.push({ step: def.key, kind: 'sensitive', message: `${defTitle(def)} — ${title}` })
    }
  }
  return points
}
