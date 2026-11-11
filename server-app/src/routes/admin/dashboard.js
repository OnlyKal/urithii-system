import { Router } from 'express';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { internalItemWhere } from '../../services/access.js';
import { verifyAuditChain } from '../../services/audit.js';

// Tableau de bord (§56) : chiffres calculés sur les données réelles, filtrés
// selon les permissions de l'utilisateur.
const router = Router();
const P = PERMISSIONS;

const PENDING = [
  'SUBMITTED', 'IN_TRANSCRIPTION', 'IN_TRANSLATION', 'IN_DOCUMENT_REVIEW',
  'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW', 'AWAITING_AUTHORIZATION', 'VALIDATED', 'SCHEDULED',
];

router.get('/', async (req, res) => {
  const user = req.user;
  const has = (p) => user.permissions.includes(p);
  const visible = internalItemWhere(user);
  const count = (where) => prisma.culturalItem.count({ where: { AND: [visible, where] } });

  // Répartition des fiches visibles par statut, pour les compteurs des files de travail.
  const grouped = await prisma.culturalItem.groupBy({ by: ['status'], where: visible, _count: { _all: true } });
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const mine = await prisma.culturalItem.groupBy({ by: ['status'], where: { AND: [visible, { createdById: user.id }] }, _count: { _all: true } });
  const myByStatus = Object.fromEntries(mine.map((g) => [g.status, g._count._all]));

  const openTakedowns = () =>
    prisma.takedownRequest.count({ where: { status: { in: ['RECEIVED', 'UNDER_REVIEW', 'CONTENT_SUSPENDED'] } } });

  // Compteurs seuls, pour les onglets des files de travail (appel léger).
  if (req.query.scope === 'counts') {
    const counts = { byStatus, myByStatus };
    if (has(P.REPORTS_MANAGE)) counts.takedownsOpen = await openTakedowns();
    return res.json(counts);
  }

  const stats = {
    communities: await prisma.community.count(),
    communitiesPublished: await prisma.community.count({ where: { isPublished: true } }),
    items: await count({}),
    itemsPublished: await count({ publishedVersionId: { not: null }, status: { notIn: ['SUSPENDED', 'WITHDRAWN', 'ARCHIVED'] } }),
    itemsPending: await count({ status: { in: PENDING } }),
    itemsToRevise: await count({ status: { in: ['NEEDS_COMPLETION', 'UNDER_REVISION'] } }),
    testimonies: await count({ verificationStatus: 'TESTIMONY' }),
    media: await prisma.mediaAsset.count(),
    transcriptions: await prisma.textDocument.count({ where: { kind: 'TRANSCRIPTION' } }),
    translations: await prisma.textDocument.count({ where: { kind: 'TRANSLATION' } }),
    textsUnverified: await prisma.textDocument.count({ where: { verification: 'UNVERIFIED' } }),
    missionsActive: await prisma.mission.count({ where: { status: { in: ['PREPARATION', 'IN_PROGRESS', 'PROCESSING'] } } }),
  };

  // Tâches de l'utilisateur selon ses rôles.
  const queues = {};
  if (has(P.CONTENT_EDIT)) queues.documentReview = await count({ status: { in: ['SUBMITTED', 'IN_DOCUMENT_REVIEW', 'AWAITING_AUTHORIZATION'] } });
  if (has(P.CONTENT_VALIDATE_CULTURAL)) queues.culturalReview = await count({ status: 'IN_CULTURAL_REVIEW' });
  if (has(P.CONTENT_VALIDATE_EDITORIAL)) queues.editorialReview = await count({ status: 'IN_EDITORIAL_REVIEW' });
  if (has(P.CONTENT_PUBLISH)) queues.toPublish = await count({ status: 'VALIDATED' });
  if (has(P.TRANSCRIPTION_EDIT)) queues.transcription = await count({ status: 'IN_TRANSCRIPTION' });
  if (has(P.TRANSLATION_EDIT)) queues.translation = await count({ status: 'IN_TRANSLATION' });
  if (has(P.CONTENT_CREATE)) queues.myToComplete = await count({ createdById: user.id, status: 'NEEDS_COMPLETION' });

  // Dossiers de collecte : tous pour l'administrateur, les siens pour un collecteur.
  const dossierRows = await prisma.collectionDossier.groupBy({
    by: ['status'],
    where: has(P.DOSSIERS_REVIEW) ? {} : { collectorId: user.id },
    _count: { _all: true },
  });
  const dossiers = Object.fromEntries(dossierRows.map((g) => [g.status, g._count._all]));

  const result = { stats, queues, byStatus, myByStatus, dossiers };

  if (has(P.REPORTS_MANAGE)) {
    result.takedownsOpen = await openTakedowns();
  }
  if (has(P.AUDIT_READ)) result.auditChain = await verifyAuditChain();
  if (has(P.BACKUPS_MANAGE)) {
    const last = (kind) => prisma.backupRun.findFirst({ where: { kind }, orderBy: { startedAt: 'desc' } });
    result.preservation = {
      lastBackup: await last('BACKUP'),
      lastRestoreTest: await last('RESTORE_TEST'),
      lastIntegrityCheck: await last('INTEGRITY_CHECK'),
      filesCorrupted: await prisma.storedFile.count({ where: { integrityStatus: { in: ['CORRUPTED', 'MISSING'] } } }),
    };
  }
  res.json(result);
});

export default router;
