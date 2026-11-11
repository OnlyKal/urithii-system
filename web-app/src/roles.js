import { t } from './i18n/index.js'

export const ROLE_LABELS = {
  SUPER_ADMIN: t('roles.superAdministrateur'),
  RESPONSABLE_COLLECTE: t('roles.responsableDeCollecte'),
  COLLECTEUR: t('mission.collecteur'),
  TRANSCRIPTEUR: t('roles.transcripteur'),
  TRADUCTEUR: t('roles.traducteur'),
  VALIDATEUR: t('roles.validateurCulturelOuScientifique'),
  EDITEUR: t('reference.editeur'),
}

export const roleLabel = (role) => ROLE_LABELS[role] ?? role

// Types de comptes proposés à la création : administrateur et collecteur.
export const ACCOUNT_TYPES = ['SUPER_ADMIN', 'COLLECTEUR']
