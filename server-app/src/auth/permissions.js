// Correspondance rôles → permissions (cahier des charges §31 à §38).
// Les permissions sont vérifiées côté serveur (§67). Les valeurs par défaut
// ci-dessous peuvent être modifiées par l'administration (§37) : elles sont
// alors enregistrées dans la table RolePermission et mises en cache.

export const PERMISSIONS = {
  USERS_MANAGE: 'users.manage',
  AUDIT_READ: 'audit.read',
  SETTINGS_MANAGE: 'settings.manage',
  COMMUNITIES_MANAGE: 'communities.manage',
  CATEGORIES_MANAGE: 'categories.manage',
  MISSIONS_MANAGE: 'missions.manage',
  MISSIONS_PARTICIPATE: 'missions.participate',
  CONTENT_CREATE: 'content.create',
  CONTENT_EDIT: 'content.edit',
  TRANSCRIPTION_EDIT: 'transcription.edit',
  TRANSLATION_EDIT: 'translation.edit',
  CONTENT_VALIDATE_CULTURAL: 'content.validate_cultural',
  CONTENT_VALIDATE_EDITORIAL: 'content.validate_editorial',
  CONTENT_PUBLISH: 'content.publish',
  REPORTS_MANAGE: 'reports.manage',
  FILES_UPLOAD: 'files.upload',
  SOURCES_MANAGE: 'sources.manage',
  PERSONS_MANAGE: 'persons.manage',
  CONSENTS_MANAGE: 'consents.manage',
  BACKUPS_MANAGE: 'backups.manage',
  EXPORT_FULL: 'export.full',
  DOSSIERS_COLLECT: 'dossiers.collect',
  DOSSIERS_REVIEW: 'dossiers.review',
  GAMES_MANAGE: 'games.manage',
};

export const PERMISSION_LABELS = {
  'users.manage': 'Gérer les comptes',
  'audit.read': 'Consulter le journal d’audit',
  'settings.manage': 'Gérer les paramètres et permissions',
  'communities.manage': 'Gérer communautés, lieux et langues',
  'categories.manage': 'Gérer les catégories',
  'missions.manage': 'Créer et gérer les missions',
  'missions.participate': 'Participer aux missions',
  'content.create': 'Créer des fiches culturelles',
  'content.edit': 'Modifier toutes les fiches',
  'transcription.edit': 'Transcrire',
  'translation.edit': 'Traduire',
  'content.validate_cultural': 'Validation culturelle',
  'content.validate_editorial': 'Validation éditoriale',
  'content.publish': 'Publier et suspendre',
  'reports.manage': 'Traiter les signalements',
  'files.upload': 'Téléverser des médias',
  'sources.manage': 'Gérer les sources',
  'persons.manage': 'Gérer les personnes ressources',
  'consents.manage': 'Gérer les consentements',
  'backups.manage': 'Gérer les sauvegardes',
  'export.full': 'Exporter toutes les données',
  'dossiers.collect': 'Remplir et soumettre des dossiers de collecte',
  'dossiers.review': 'Vérifier, valider et publier les dossiers de collecte',
  'games.manage': 'Gérer le module Jeux (missions, récompenses, statistiques)',
};

const P = PERMISSIONS;

export const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: Object.values(P),
  RESPONSABLE_COLLECTE: [
    P.MISSIONS_MANAGE, P.MISSIONS_PARTICIPATE, P.CONTENT_CREATE, P.FILES_UPLOAD,
    P.SOURCES_MANAGE, P.PERSONS_MANAGE, P.CONSENTS_MANAGE, P.DOSSIERS_COLLECT,
  ],
  COLLECTEUR: [
    P.MISSIONS_PARTICIPATE, P.CONTENT_CREATE, P.FILES_UPLOAD, P.SOURCES_MANAGE,
    P.PERSONS_MANAGE, P.CONSENTS_MANAGE, P.DOSSIERS_COLLECT,
  ],
  TRANSCRIPTEUR: [P.TRANSCRIPTION_EDIT],
  TRADUCTEUR: [P.TRANSLATION_EDIT],
  VALIDATEUR: [P.CONTENT_VALIDATE_CULTURAL],
  EDITEUR: [P.CONTENT_EDIT, P.CONTENT_VALIDATE_EDITORIAL, P.CONTENT_PUBLISH, P.SOURCES_MANAGE, P.FILES_UPLOAD],
};

// Conservé pour compatibilité avec le code de la phase 2.
export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

export const ROLES = Object.keys(DEFAULT_ROLE_PERMISSIONS);
export const ALL_PERMISSIONS = Object.values(P);

let overrides = {};

// Charge les permissions personnalisées. Un rôle sans ligne en base garde ses
// valeurs par défaut. Le super administrateur conserve toujours tout, pour
// qu'aucune erreur de configuration ne bloque l'administration.
export async function loadRolePermissions(prisma) {
  const rows = await prisma.rolePermission.findMany();
  const next = {};
  for (const row of rows) (next[row.role] ??= []).push(row.permission);
  overrides = next;
}

// Ligne enregistrée pour un rôle volontairement privé de toute permission.
export const NO_PERMISSION = '__none__';

export function permissionsForRole(role) {
  if (role === 'SUPER_ADMIN') return DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN;
  const custom = overrides[role];
  if (custom) return custom.filter((p) => p !== NO_PERMISSION);
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

export function permissionsForRoles(roles) {
  return [...new Set(roles.flatMap(permissionsForRole))];
}

export function isCustomized(role) {
  return Boolean(overrides[role]);
}
