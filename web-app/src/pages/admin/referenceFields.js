import { ATTRIBUTION_LABELS, options, SOURCE_STATUS_LABELS, SOURCE_TYPE_LABELS } from '../../labels.js'
import { t } from '../../i18n/index.js'

// Champs des référentiels partagés entre leurs pages de gestion et les
// fenêtres de création rapide de l'éditeur de fiche.
export const sourceFields = () => [
  { name: 'type', label: t('common.type'), type: 'select', required: true, options: options(SOURCE_TYPE_LABELS) },
  { name: 'title', label: t('common.title'), required: true },
  { name: 'author', label: t('common.author') },
  { name: 'date', label: t('common.date'), help: t('reference.exacteOuApproximativeParExemple') },
  { name: 'publisher', label: t('reference.editeur') },
  { name: 'reference', label: t('reference.referenceBibliographique'), type: 'textarea', rows: 2 },
  { name: 'url', label: t('reference.lien') },
  { name: 'provenance', label: t('reference.provenance') },
  { name: 'rights', label: t('reference.droitsEtConditionsDUtilisation'), type: 'textarea', rows: 2 },
  { name: 'status', label: t('common.status'), type: 'select', options: options(SOURCE_STATUS_LABELS) },
  { name: 'statusNote', label: t('reference.precisionSurLeStatut'), type: 'textarea', rows: 2 },
  { name: 'isPublic', label: t('reference.peutEtreCiteeSurLe'), type: 'checkbox', default: true },
  { name: 'notes', label: t('reference.notesInternes'), type: 'textarea', rows: 2 },
]

export const personFields = (communities, defaultCommunityId) => [
  { name: 'fullName', label: t('reference.nomCompletConfidentiel'), required: true },
  { name: 'attributionMode', label: t('reference.attributionPublique'), type: 'select', options: options(ATTRIBUTION_LABELS) },
  { name: 'publicName', label: t('reference.nomOuPseudonymeAffiche'), help: t('reference.utiliseSiLAttributionEst') },
  { name: 'communityId', label: t('common.community'), type: 'select', options: communities.map((c) => ({ value: c.id, label: c.name })), default: defaultCommunityId },
  { name: 'locality', label: t('reference.localite') },
  { name: 'birthYear', label: t('reference.anneeDeNaissance'), type: 'number' },
  { name: 'isMinor', label: t('reference.personneMineure'), type: 'checkbox' },
  { name: 'guardianName', label: t('reference.representantLegal'), hidden: (v) => !v.isMinor },
  { name: 'contact', label: t('reference.coordonneesConfidentiel'), type: 'textarea', rows: 2 },
  { name: 'notes', label: t('common.notes'), type: 'textarea', rows: 3 },
]

export const CONSENT_FLAGS = [
  ['canStore', t('reference.conserverLesEnregistrements')],
  ['canProcess', t('reference.traiterClasserDecrire')],
  ['allowsInterview', t('reference.participerALEntretien')],
  ['allowsAudio', t('reference.enregistrementAudio')],
  ['allowsVideo', t('reference.enregistrementVideo')],
  ['allowsPhoto', t('labels.photographie')],
  ['allowsTranscription', t('text.transcription')],
  ['canTranslate', t('text.traduction')],
  ['canPublish', t('reference.publicationSurLeSite')],
  ['canReuse', t('reference.reutilisationParDesTiers')],
  ['guardianConsent', t('reference.accordDuRepresentantLegalMineur')],
]

export const consentFields = (persons, missions, defaults = {}) => [
  {
    name: 'resourcePersonId',
    label: t('reference.personneRessource'),
    type: 'select',
    options: persons.map((p) => ({ value: p.id, label: p.fullName })),
    default: defaults.resourcePersonId,
  },
  { name: 'missionId', label: t('reference.mission'), type: 'select', options: missions.map((m) => ({ value: m.id, label: `${m.code} — ${m.title}` })), default: defaults.missionId },
  { name: 'collectedAt', label: t('reference.dateDuRecueil'), type: 'date', required: true },
  ...CONSENT_FLAGS.map(([name, label]) => ({ name, label, type: 'checkbox', default: ['canStore', 'allowsInterview'].includes(name) })),
  { name: 'attribution', label: t('reference.attributionDuNom'), type: 'select', options: options(ATTRIBUTION_LABELS) },
  { name: 'restrictions', label: t('reference.restrictionsDeDiffusion'), type: 'textarea', rows: 3 },
  { name: 'communityAuthorization', label: t('reference.autorisationCommunautaireSavoirsCollectifsOu'), type: 'textarea', rows: 2 },
  { name: 'validFrom', label: t('reference.valableAPartirDu'), type: 'date' },
  { name: 'validUntil', label: t('reference.valableJusquAu'), type: 'date' },
  { name: 'notes', label: t('common.notes'), type: 'textarea', rows: 2 },
]

export const consentTransform = (p) => ({ ...p, validFrom: p.validFrom || null, validUntil: p.validUntil || null })
