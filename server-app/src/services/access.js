import { PERMISSIONS } from '../auth/permissions.js';

// Règles d'accès aux fiches et médias (§7, §47).
//
// Côté public : une fiche n'est visible que si elle possède une version
// publiée, que son niveau d'accès est PUBLIC et qu'elle n'est ni suspendue,
// ni retirée, ni archivée.
//
// Côté contributeurs :
//   PUBLIC, CONTRIBUTORS → tout compte actif
//   TEAM, SPECIAL        → auteur, super administrateur, ou accès nominatif valide
//   PRIVATE              → auteur ou super administrateur

export const HIDDEN_STATUSES = ['SUSPENDED', 'WITHDRAWN', 'ARCHIVED'];

export const publicItemWhere = {
  publishedVersionId: { not: null },
  accessLevel: 'PUBLIC',
  status: { notIn: HIDDEN_STATUSES },
};

export function isSuperAdmin(user) {
  return user?.roles?.includes('SUPER_ADMIN');
}

export function internalItemWhere(user) {
  if (isSuperAdmin(user)) return {};
  const now = new Date();
  return {
    OR: [
      { accessLevel: { in: ['PUBLIC', 'CONTRIBUTORS'] } },
      { createdById: user.id },
      {
        accessLevel: { in: ['TEAM', 'SPECIAL'] },
        accessGrants: { some: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } },
      },
    ],
  };
}

export function canViewItemInternally(user, item, grants = []) {
  if (!user) return false;
  if (isSuperAdmin(user) || item.createdById === user.id) return true;
  if (['PUBLIC', 'CONTRIBUTORS'].includes(item.accessLevel)) return true;
  if (['TEAM', 'SPECIAL'].includes(item.accessLevel)) {
    const now = new Date();
    return grants.some((g) => g.userId === user.id && (!g.expiresAt || g.expiresAt > now));
  }
  return false;
}

// Modification du contenu d'une fiche : auteur tant qu'elle n'a pas quitté
// la phase de rédaction, ou détenteur de content.edit.
export const AUTHOR_EDITABLE_STATUSES = ['DRAFT', 'IN_PREPARATION', 'NEEDS_COMPLETION'];

export function canEditItem(user, item) {
  if (user.permissions.includes(PERMISSIONS.CONTENT_EDIT)) return true;
  return (
    item.createdById === user.id &&
    user.permissions.includes(PERMISSIONS.CONTENT_CREATE) &&
    AUTHOR_EDITABLE_STATUSES.includes(item.status)
  );
}

// Un média est diffusable publiquement s'il est de niveau PUBLIC, si ses
// droits le permettent, et s'il illustre au moins une fiche publique.
// Un média est public s'il est au niveau « Public » et illustre une fiche
// publiée (les consentements ne conditionnent plus la diffusion).
export function publicMediaWhere() {
  return { accessLevel: 'PUBLIC', items: { some: { item: publicItemWhere } } };
}
