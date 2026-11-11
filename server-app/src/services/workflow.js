import { PERMISSIONS } from '../auth/permissions.js';
import { prisma } from '../db.js';
import { badRequest, forbidden, HttpError } from '../lib/errors.js';
import { recordAudit } from './audit.js';
import { itemInclude, loadItemForUser, publicationProblems, publishInTransaction } from './items.js';

// Cycle de vie des fiches (§39). Pour chaque statut : statuts suivants
// autorisés et permissions qui permettent la transition. AUTHOR désigne
// l'auteur de la fiche (avec content.create) ou un détenteur de content.edit.
const P = PERMISSIONS;
const AUTHOR = 'AUTHOR';
const EDIT = [P.CONTENT_EDIT];
const CULTURAL = [P.CONTENT_VALIDATE_CULTURAL];
const EDITORIAL = [P.CONTENT_VALIDATE_EDITORIAL];
const PUBLISH = [P.CONTENT_PUBLISH];

export const TRANSITIONS = {
  DRAFT: { IN_PREPARATION: AUTHOR, SUBMITTED: AUTHOR, ARCHIVED: EDIT },
  IN_PREPARATION: { SUBMITTED: AUTHOR, DRAFT: AUTHOR, ARCHIVED: EDIT },
  SUBMITTED: { NEEDS_COMPLETION: EDIT, IN_TRANSCRIPTION: EDIT, IN_TRANSLATION: EDIT, IN_DOCUMENT_REVIEW: EDIT },
  NEEDS_COMPLETION: { SUBMITTED: AUTHOR, ARCHIVED: EDIT },
  IN_TRANSCRIPTION: {
    IN_TRANSLATION: [P.TRANSCRIPTION_EDIT, P.CONTENT_EDIT],
    IN_DOCUMENT_REVIEW: [P.TRANSCRIPTION_EDIT, P.CONTENT_EDIT],
  },
  IN_TRANSLATION: {
    IN_DOCUMENT_REVIEW: [P.TRANSLATION_EDIT, P.CONTENT_EDIT],
    IN_TRANSCRIPTION: [P.TRANSLATION_EDIT, P.CONTENT_EDIT],
  },
  IN_DOCUMENT_REVIEW: { IN_CULTURAL_REVIEW: EDIT, NEEDS_COMPLETION: EDIT, IN_TRANSCRIPTION: EDIT, IN_TRANSLATION: EDIT },
  IN_CULTURAL_REVIEW: { IN_EDITORIAL_REVIEW: CULTURAL, NEEDS_COMPLETION: CULTURAL, AWAITING_AUTHORIZATION: CULTURAL },
  IN_EDITORIAL_REVIEW: {
    VALIDATED: EDITORIAL,
    NEEDS_COMPLETION: EDITORIAL,
    AWAITING_AUTHORIZATION: EDITORIAL,
    IN_CULTURAL_REVIEW: EDITORIAL,
  },
  AWAITING_AUTHORIZATION: { IN_CULTURAL_REVIEW: EDIT, IN_EDITORIAL_REVIEW: EDIT, NEEDS_COMPLETION: EDIT },
  VALIDATED: { PUBLISHED: PUBLISH, SCHEDULED: PUBLISH, UNDER_REVISION: EDIT },
  SCHEDULED: { PUBLISHED: PUBLISH, VALIDATED: PUBLISH },
  PUBLISHED: { UNDER_REVISION: EDIT, SUSPENDED: [P.CONTENT_PUBLISH, P.REPORTS_MANAGE], WITHDRAWN: PUBLISH },
  UNDER_REVISION: { IN_DOCUMENT_REVIEW: EDIT, IN_CULTURAL_REVIEW: EDIT, IN_EDITORIAL_REVIEW: EDIT },
  SUSPENDED: { PUBLISHED: PUBLISH, UNDER_REVISION: EDIT, WITHDRAWN: PUBLISH },
  WITHDRAWN: { UNDER_REVISION: EDIT, ARCHIVED: EDIT },
  ARCHIVED: { DRAFT: [P.SETTINGS_MANAGE] },
};

export const STATUSES = Object.keys(TRANSITIONS);

// Statuts dont la sortie vaut approbation. Le motif d'une transition est
// toujours facultatif (décision du porteur du projet) : il est conseillé pour
// une demande de compléments, une suspension, un retrait ou un archivage.
const REVIEW_STATUSES = ['IN_DOCUMENT_REVIEW', 'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW'];
const REASON_REQUIRED = [];

// Pour une fiche sensible (§38), validation et publication doivent être
// faites par une autre personne que l'auteur, et la publication par une
// autre personne que le validateur culturel.
const SEPARATED_TRANSITIONS = new Set([
  'IN_CULTURAL_REVIEW>IN_EDITORIAL_REVIEW',
  'IN_EDITORIAL_REVIEW>VALIDATED',
  'VALIDATED>PUBLISHED',
  'VALIDATED>SCHEDULED',
  'SCHEDULED>PUBLISHED',
  'SUSPENDED>PUBLISHED',
]);

function hasRequirement(user, item, requirement) {
  if (requirement === AUTHOR) {
    return (
      user.permissions.includes(P.CONTENT_EDIT) ||
      (item.createdById === user.id && user.permissions.includes(P.CONTENT_CREATE))
    );
  }
  return requirement.some((p) => user.permissions.includes(p));
}

async function lastCulturalApprover(itemId) {
  const decision = await prisma.validationDecision.findFirst({
    where: { itemId, fromStatus: 'IN_CULTURAL_REVIEW', toStatus: 'IN_EDITORIAL_REVIEW' },
    orderBy: { createdAt: 'desc' },
  });
  return decision?.authorId;
}

export async function separationProblem(user, item, toStatus) {
  if (!item.isSensitive || !SEPARATED_TRANSITIONS.has(`${item.status}>${toStatus}`)) return null;
  if (item.createdById === user.id) {
    return 'Fiche sensible : l’auteur ne peut pas la valider ni la publier lui-même';
  }
  if (['PUBLISHED', 'SCHEDULED'].includes(toStatus) && (await lastCulturalApprover(item.id)) === user.id) {
    return 'Fiche sensible : la publication doit être faite par une autre personne que le validateur culturel';
  }
  return null;
}

export async function allowedTransitions(user, item) {
  const targets = Object.entries(TRANSITIONS[item.status] ?? {})
    .filter(([, requirement]) => hasRequirement(user, item, requirement))
    .map(([status]) => status);
  const result = [];
  for (const status of targets) {
    const blocked = await separationProblem(user, item, status);
    result.push({ status, reasonRequired: REASON_REQUIRED.includes(status), blockedReason: blocked });
  }
  return result;
}

function decisionType(fromStatus, toStatus) {
  if (toStatus === 'NEEDS_COMPLETION') return 'REQUEST_CHANGES';
  if (REVIEW_STATUSES.includes(fromStatus) && toStatus === 'AWAITING_AUTHORIZATION') return 'TRANSITION';
  if (REVIEW_STATUSES.includes(fromStatus)) return 'APPROVE';
  return 'TRANSITION';
}

export async function transitionItem(itemId, { toStatus, reason, comments, requestedChanges, scheduledAt }, user, ip) {
  const item = await loadItemForUser(itemId, user);
  const requirement = TRANSITIONS[item.status]?.[toStatus];
  if (!requirement) throw badRequest(`Transition impossible de « ${item.status} » vers « ${toStatus} »`);
  if (!hasRequirement(user, item, requirement)) throw forbidden('Vous n’avez pas la permission pour cette étape');

  const separation = await separationProblem(user, item, toStatus);
  if (separation) throw forbidden(separation);
  if (REASON_REQUIRED.includes(toStatus) && !reason?.trim()) throw badRequest('Un motif est obligatoire pour cette étape');

  if (toStatus === 'PUBLISHED' || toStatus === 'SCHEDULED') {
    const problems = publicationProblems(item);
    if (problems.length) throw new HttpError(422, 'Publication impossible', problems.map((message) => ({ message })));
  }
  if (toStatus === 'SCHEDULED' && (!scheduledAt || scheduledAt <= new Date())) {
    throw badRequest('Indiquez une date de publication future');
  }

  return prisma.$transaction(async (tx) => {
    if (toStatus === 'PUBLISHED') {
      await publishInTransaction(tx, item);
    } else {
      await tx.culturalItem.update({
        where: { id: item.id },
        data: {
          status: toStatus,
          updatedById: user.id,
          scheduledAt: toStatus === 'SCHEDULED' ? scheduledAt : null,
        },
      });
    }
    await tx.validationDecision.create({
      data: {
        itemId: item.id,
        type: decisionType(item.status, toStatus),
        fromStatus: item.status,
        toStatus,
        reason,
        comments,
        requestedChanges,
        version: item.currentVersion,
        authorId: user.id,
      },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: toStatus === 'PUBLISHED' ? 'ITEM_PUBLISHED' : 'ITEM_STATUS_CHANGED',
        entityType: 'CulturalItem',
        entityId: item.id,
        details: { from: item.status, to: toStatus, version: item.currentVersion },
        ip,
      },
      tx,
    );
    return tx.culturalItem.findUnique({ where: { id: item.id }, include: itemInclude });
  });
}

export async function commentItem(itemId, { comments }, user, ip) {
  const item = await loadItemForUser(itemId, user);
  const decision = await prisma.validationDecision.create({
    data: { itemId, type: 'COMMENT', comments, version: item.currentVersion, authorId: user.id },
  });
  await recordAudit({ actorId: user.id, action: 'ITEM_COMMENTED', entityType: 'CulturalItem', entityId: itemId, ip });
  return decision;
}

// Publication programmée : appelée périodiquement par le planificateur.
// Si les conditions ne sont plus réunies, la fiche revient à « Validé ».
export async function publishDueItems(now = new Date()) {
  const due = await prisma.culturalItem.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    include: itemInclude,
  });
  const results = [];
  for (const item of due) {
    const scheduler = await prisma.validationDecision.findFirst({
      where: { itemId: item.id, toStatus: 'SCHEDULED' },
      orderBy: { createdAt: 'desc' },
    });
    const authorId = scheduler?.authorId ?? item.updatedById;
    const problems = publicationProblems(item, now);
    await prisma.$transaction(async (tx) => {
      if (problems.length === 0) await publishInTransaction(tx, item, now);
      else await tx.culturalItem.update({ where: { id: item.id }, data: { status: 'VALIDATED', scheduledAt: null } });
      await tx.validationDecision.create({
        data: {
          itemId: item.id,
          type: 'TRANSITION',
          fromStatus: 'SCHEDULED',
          toStatus: problems.length ? 'VALIDATED' : 'PUBLISHED',
          reason: problems.length
            ? `Publication programmée annulée : ${problems.join(' ; ')}`
            : 'Publication programmée',
          version: item.currentVersion,
          authorId,
        },
      });
      await recordAudit(
        {
          action: problems.length ? 'ITEM_SCHEDULE_FAILED' : 'ITEM_PUBLISHED',
          entityType: 'CulturalItem',
          entityId: item.id,
          details: { scheduled: true, problems },
        },
        tx,
      );
    });
    results.push({ id: item.id, published: problems.length === 0 });
  }
  return results;
}
