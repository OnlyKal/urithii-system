import { prisma } from '../db.js';
import { recordAudit } from './audit.js';

// Un consentement autorise la publication s'il n'est ni révoqué ni expiré,
// s'il est déjà en vigueur, et, pour un mineur, si le représentant légal a
// donné son accord (§25 étape 3, §39).
export function consentProblems(consent, now = new Date(), { forPublication = true } = {}) {
  const problems = [];
  if (consent.revokedAt) problems.push('consentement révoqué');
  if (consent.validUntil && consent.validUntil < now) problems.push('consentement expiré');
  if (consent.validFrom && consent.validFrom > now) problems.push('consentement pas encore en vigueur');
  if (forPublication && !consent.canPublish) problems.push('la publication n’est pas autorisée par le consentement');
  if (consent.resourcePerson?.isMinor && !consent.guardianConsent) {
    problems.push('accord du représentant légal manquant (personne mineure)');
  }
  return problems;
}

export function isConsentValidForPublication(consent, now = new Date()) {
  return consentProblems(consent, now).length === 0;
}

// Révocation : les fiches publiées qui en dépendent sont suspendues
// immédiatement, par prudence (§48), en attendant un réexamen.
export async function revokeConsent(consentId, { reason, actor, ip }) {
  return prisma.$transaction(async (tx) => {
    const consent = await tx.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date(), revocationReason: reason },
    });

    const linkedItems = await tx.culturalItem.findMany({
      where: {
        publishedVersionId: { not: null },
        status: { notIn: ['SUSPENDED', 'WITHDRAWN', 'ARCHIVED'] },
        OR: [
          { consents: { some: { consentId } } },
          { media: { some: { media: { consentId } } } },
        ],
      },
      select: { id: true, status: true, currentVersion: true },
    });

    for (const item of linkedItems) {
      await tx.culturalItem.update({ where: { id: item.id }, data: { status: 'SUSPENDED', updatedById: actor.id } });
      await tx.validationDecision.create({
        data: {
          itemId: item.id,
          type: 'TRANSITION',
          fromStatus: item.status,
          toStatus: 'SUSPENDED',
          reason: 'Suspension automatique : consentement révoqué',
          version: item.currentVersion,
          authorId: actor.id,
        },
      });
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: 'CONSENT_REVOKED',
        entityType: 'Consent',
        entityId: consentId,
        details: { suspendedItems: linkedItems.map((i) => i.id) },
        ip,
      },
      tx,
    );
    return { consent, suspendedItems: linkedItems.map((i) => i.id) };
  });
}
