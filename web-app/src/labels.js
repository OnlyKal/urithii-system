import { locale, t } from './i18n/index.js'

export const STATUS_LABELS = {
  DRAFT: t('labels.brouillon'),
  IN_PREPARATION: t('labels.enPreparation'),
  SUBMITTED: t('labels.soumis'),
  NEEDS_COMPLETION: t('labels.aCompleter'),
  IN_TRANSCRIPTION: t('labels.enTranscription'),
  IN_TRANSLATION: t('labels.enTraduction'),
  IN_DOCUMENT_REVIEW: t('labels.enVerificationDocumentaire'),
  IN_CULTURAL_REVIEW: t('labels.enValidationCulturelle'),
  IN_EDITORIAL_REVIEW: t('labels.enValidationEditoriale'),
  AWAITING_AUTHORIZATION: t('labels.enAttenteDAutorisationComplementaire'),
  VALIDATED: t('labels.valide'),
  SCHEDULED: t('labels.programmePourPublication'),
  PUBLISHED: t('labels.publie'),
  UNDER_REVISION: t('labels.enCoursDeRevision'),
  SUSPENDED: t('labels.publicationSuspendue'),
  WITHDRAWN: t('labels.retireDeLaPublication'),
  ARCHIVED: t('labels.archive'),
}

export const ACCESS_LABELS = {
  PUBLIC: t('labels.public'),
  CONTRIBUTORS: t('labels.utilisateursAutorises'),
  TEAM: t('labels.equipeDesignee'),
  SPECIAL: t('labels.autorisationParticuliere'),
  PRIVATE: t('labels.conservationPrivee'),
}

export const VERIFICATION_LABELS = {
  SOURCED: t('info.etayeParUneSource'),
  TESTIMONY: t('info.temoignagePersonnel'),
  ORAL_TRADITION: t('info.traditionOrale'),
  CORROBORATED: t('labels.corroboreParPlusieursSources'),
  CONTESTED: t('info.informationContestee'),
  HYPOTHESIS: t('labels.hypothese'),
  INCOMPLETE: t('labels.verificationIncomplete'),
}

export const VERIFICATION_HELP = {
  SOURCED: t('labels.cetteInformationSAppuieSur'),
  TESTIMONY: t('labels.ceContenuRapporteLeTemoignage'),
  ORAL_TRADITION: t('labels.recitTransmisOralementIlN'),
  CORROBORATED: t('labels.plusieursSourcesConcordent'),
  CONTESTED: t('labels.cetteInformationFaitLObjet'),
  HYPOTHESIS: t('labels.interpretationOuHypotheseAConfirmer'),
  INCOMPLETE: t('labels.laVerificationDeCeContenu'),
}

export const DATE_KIND_LABELS = { EXACT: t('labels.dateExacte'), APPROXIMATE: t('labels.dateApproximative'), PERIOD: t('item.periode'), UNKNOWN: t('labels.dateInconnue') }

export const DOC_STATUS_LABELS = {
  NOT_STARTED: t('labels.documentationNonCommencee'),
  IN_PROGRESS: t('home.documentationEnCours'),
  PARTIAL: t('labels.documentationPartielle'),
  ADVANCED: t('labels.documentationAvancee'),
}

export const PLACE_TYPE_LABELS = {
  COUNTRY: t('labels.pays'),
  PROVINCE: t('drcMap.province'),
  TERRITORY: t('labels.territoire'),
  CITY: t('labels.ville'),
  COMMUNE: t('labels.commune'),
  CHIEFDOM: t('labels.chefferieOuSecteur'),
  LOCALITY: t('reference.localite'),
  VILLAGE: t('labels.village'),
  OTHER: t('labels.autre'),
}

export const NAME_KIND_LABELS = {
  PRIMARY: t('communities.nomPrincipal'),
  AUTONYM: t('labels.autodesignation'),
  EXONYM: t('labels.denominationExterieure'),
  HISTORICAL: t('labels.denominationHistorique'),
  VARIANT: t('labels.variante'),
}

export const SOURCE_TYPE_LABELS = {
  BOOK: t('labels.livre'),
  ARTICLE: t('labels.articleScientifique'),
  THESIS: t('labels.theseOuMemoire'),
  ARCHIVE: t('labels.archive2'),
  REPORT: t('labels.rapport'),
  PHOTOGRAPH: t('labels.photographie'),
  TESTIMONY: t('labels.temoignage'),
  RECORDING: t('labels.enregistrement'),
  ADMINISTRATIVE: t('labels.documentAdministratif'),
  WEBSITE: t('labels.siteWeb'),
  COLLECTION: t('labels.collectionPatrimoniale'),
  FIELDWORK: t('labels.entretienOuObservationDeTerrain'),
  OTHER: t('labels.autre'),
}

export const SOURCE_STATUS_LABELS = { ACTIVE: t('labels.active'), CONTESTED: t('labels.contestee'), UNAVAILABLE: t('labels.indisponible'), REPLACED: t('labels.remplacee') }

export const MEDIA_KIND_LABELS = { PHOTO: t('labels.photographie'), VIDEO: t('labels.video'), AUDIO: t('labels.enregistrementSonore'), DOCUMENT: t('reference.document') }

export const ATTRIBUTION_LABELS = { NAME: t('common.name'), PSEUDONYM: t('labels.pseudonyme'), ANONYMOUS: t('labels.anonyme') }

export const MISSION_STATUS_LABELS = {
  PLANNED: t('labels.planifiee'),
  PREPARATION: t('labels.enPreparation'),
  IN_PROGRESS: t('labels.enCours'),
  PROCESSING: t('labels.traitementDocumentaire'),
  COMPLETED: t('labels.cloturee'),
  CANCELLED: t('labels.annulee'),
}

export const RELATION_LABELS = {
  RELATED: t('labels.contenuAssocie'),
  VARIANT_OF: t('reference.varianteDe'),
  PART_OF: t('labels.faitPartieDe'),
  INGREDIENT: t('labels.ingredient'),
  INSTRUMENT: t('labels.instrument'),
  COSTUME: t('labels.costume'),
  SONG: t('labels.chant'),
  CONTEXT: t('labels.contexteCulturel'),
  TESTIMONY_FOR: t('labels.temoignageAssocie'),
}

export const TAKEDOWN_REASON_LABELS = {
  ERROR: t('labels.erreur'),
  MISATTRIBUTION: t('labels.mauvaiseAttribution'),
  CONSENT: t('labels.problemeDeConsentement'),
  PRIVACY: t('labels.atteinteALaViePrivee'),
  CULTURAL_RESTRICTION: t('labels.restrictionCulturelleNonRespectee'),
  UNAUTHORIZED_USE: t('labels.utilisationNonAutorisee'),
  MISLEADING: t('labels.informationDevenueTrompeuse'),
  OTHER: t('labels.autre'),
}

export const TAKEDOWN_STATUS_LABELS = {
  RECEIVED: t('labels.recue'),
  UNDER_REVIEW: t('labels.enExamen'),
  CONTENT_SUSPENDED: t('labels.contenuSuspendu'),
  RESOLVED_CORRECTED: t('labels.resolueCorrige'),
  RESOLVED_WITHDRAWN: t('labels.resolueRetire'),
  REJECTED: t('labels.rejetee'),
}

export const DECISION_LABELS = {
  TRANSITION: t('labels.changementDEtape'),
  APPROVE: t('labels.approbation'),
  REJECT: t('labels.refus'),
  REQUEST_CHANGES: t('labels.demandeDeComplements'),
  COMMENT: t('labels.commentaire'),
}

export const options = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString(locale(), { dateStyle: 'long' }) : '—')
export const formatDateTime = (value) => (value ? new Date(value).toLocaleString(locale()) : '—')

export function formatItemDate(date) {
  if (!date || date.kind === 'UNKNOWN' || !date.value) return t('labels.dateInconnue')
  if (date.kind === 'PERIOD') return `${date.value} – ${date.end ?? '?'}`
  if (date.kind === 'APPROXIMATE') return t('labels.vers', { 0: date.value })
  return date.value
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`
  return `${(bytes / 1024 ** 3).toFixed(2)} Go`
}

// Nom comparable : minuscules, sans accents ni ponctuation (« Kasaï-Central » = « kasai central »).
export const normalizeName = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
