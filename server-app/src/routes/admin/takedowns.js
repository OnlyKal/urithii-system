import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { optionalText } from '../../lib/http.js';
import { validateBody } from '../../middleware/validate.js';
import { audit, need } from './shared.js';

// Traitement des demandes de correction ou de retrait (§48).
const router = Router();
router.use(need(PERMISSIONS.REPORTS_MANAGE));

const include = {
  item: { select: { id: true, title: true, status: true, slug: true } },
  media: { select: { id: true, title: true, accessLevel: true } },
  handledBy: { select: { id: true, displayName: true } },
};

router.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const takedowns = await prisma.takedownRequest.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, include });
  res.json({ takedowns });
});

router.get('/:id', async (req, res) => {
  const takedown = await prisma.takedownRequest.findUnique({ where: { id: req.params.id }, include });
  if (!takedown) throw notFound('Demande introuvable');
  res.json({ takedown });
});

const updateSchema = z.object({
  status: z.enum(['RECEIVED', 'UNDER_REVIEW', 'CONTENT_SUSPENDED', 'RESOLVED_CORRECTED', 'RESOLVED_WITHDRAWN', 'REJECTED']),
  resolution: optionalText(10_000),
});

router.patch('/:id', validateBody(updateSchema), async (req, res) => {
  const existing = await prisma.takedownRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Demande introuvable');
  if (['RESOLVED_CORRECTED', 'RESOLVED_WITHDRAWN', 'REJECTED'].includes(req.body.status) && !req.body.resolution?.trim()) {
    throw badRequest('Indiquez la décision prise et sa justification');
  }
  const takedown = await prisma.takedownRequest.update({
    where: { id: existing.id },
    data: { ...req.body, handledById: req.user.id },
    include,
  });
  await audit(req, 'TAKEDOWN_UPDATED', 'TakedownRequest', existing.id, { from: existing.status, to: req.body.status });
  res.json({ takedown });
});

// Suspension provisoire pendant l'examen d'un risque sérieux (§48). La fiche
// et ses versions sont conservées ; seule la diffusion est interrompue.
router.post('/:id/suspend', validateBody(z.object({ reason: z.string().trim().min(3).max(2000) })), async (req, res) => {
  const takedown = await prisma.takedownRequest.findUnique({ where: { id: req.params.id }, include: { item: true, media: true } });
  if (!takedown) throw notFound('Demande introuvable');
  if (!takedown.item && !takedown.media) throw badRequest('La demande ne vise aucun contenu identifié');

  await prisma.$transaction(async (tx) => {
    if (takedown.item && !['SUSPENDED', 'WITHDRAWN', 'ARCHIVED'].includes(takedown.item.status)) {
      await tx.culturalItem.update({ where: { id: takedown.item.id }, data: { status: 'SUSPENDED', updatedById: req.user.id } });
      await tx.validationDecision.create({
        data: {
          itemId: takedown.item.id,
          type: 'TRANSITION',
          fromStatus: takedown.item.status,
          toStatus: 'SUSPENDED',
          reason: `Signalement : ${req.body.reason}`,
          version: takedown.item.currentVersion,
          authorId: req.user.id,
        },
      });
    }
    if (takedown.media && takedown.media.accessLevel === 'PUBLIC') {
      await tx.mediaAsset.update({ where: { id: takedown.media.id }, data: { accessLevel: 'CONTRIBUTORS' } });
    }
    await tx.takedownRequest.update({
      where: { id: takedown.id },
      data: { status: 'CONTENT_SUSPENDED', handledById: req.user.id },
    });
    await audit(req, 'TAKEDOWN_CONTENT_SUSPENDED', 'TakedownRequest', takedown.id, { reason: req.body.reason }, tx);
  });
  res.json({ takedown: await prisma.takedownRequest.findUnique({ where: { id: takedown.id }, include }) });
});

export default router;
