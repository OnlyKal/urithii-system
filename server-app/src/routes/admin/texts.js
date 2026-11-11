import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { optionalId, optionalText } from '../../lib/http.js';
import { validateBody } from '../../middleware/validate.js';
import { audit, can } from './shared.js';

// Transcriptions et traductions (§29, §30), versionnées indépendamment.
const router = Router();
const P = PERMISSIONS;

const editPermission = (kind) => (kind === 'TRANSCRIPTION' ? P.TRANSCRIPTION_EDIT : P.TRANSLATION_EDIT);

function assertCanEdit(req, kind) {
  if (!can(req, editPermission(kind)) && !can(req, P.CONTENT_EDIT)) throw forbidden();
}

const include = {
  language: true,
  media: { select: { id: true, title: true, kind: true } },
  item: { select: { id: true, title: true } },
  translationOf: { select: { id: true, kind: true, language: true } },
  verifiedBy: { select: { id: true, displayName: true } },
  revisions: {
    orderBy: { version: 'desc' },
    take: 1,
    include: { author: { select: { id: true, displayName: true } } },
  },
};

router.get('/', async (req, res) => {
  const where = {};
  if (typeof req.query.mediaId === 'string') where.mediaId = req.query.mediaId;
  if (typeof req.query.itemId === 'string') where.itemId = req.query.itemId;
  if (typeof req.query.kind === 'string') where.kind = req.query.kind;
  if (req.query.unverified === '1') where.verification = 'UNVERIFIED';
  const texts = await prisma.textDocument.findMany({ where, orderBy: { updatedAt: 'desc' }, include, take: 200 });
  res.json({ texts });
});

router.get('/:id', async (req, res) => {
  const text = await prisma.textDocument.findUnique({
    where: { id: req.params.id },
    include: { ...include, revisions: { orderBy: { version: 'desc' }, include: { author: { select: { id: true, displayName: true } } } } },
  });
  if (!text) throw notFound('Texte introuvable');
  res.json({ text });
});

const createSchema = z
  .object({
    kind: z.enum(['TRANSCRIPTION', 'TRANSLATION']),
    mediaId: optionalId,
    itemId: optionalId,
    translationOfId: optionalId,
    languageId: z.string().uuid(),
    method: z.enum(['MANUAL', 'AUTOMATIC']).optional(),
    translatorRole: optionalText(300),
    notes: optionalText(),
    content: z.string().min(1).max(2_000_000),
  })
  .refine((v) => v.mediaId || v.itemId || v.translationOfId, 'Rattachez le texte à un média, une fiche ou un texte original');

router.post('/', validateBody(createSchema), async (req, res) => {
  const { content, ...data } = req.body;
  assertCanEdit(req, data.kind);
  if (data.kind === 'TRANSLATION' && data.translationOfId) {
    const original = await prisma.textDocument.findUnique({ where: { id: data.translationOfId } });
    if (!original) throw badRequest('Texte original introuvable');
    data.mediaId ??= original.mediaId;
    data.itemId ??= original.itemId;
  }
  const text = await prisma.$transaction(async (tx) => {
    const created = await tx.textDocument.create({ data });
    await tx.textRevision.create({
      data: { textId: created.id, version: 1, content, reason: 'Création', authorId: req.user.id },
    });
    await audit(req, 'TEXT_CREATED', 'TextDocument', created.id, { kind: data.kind }, tx);
    return tx.textDocument.findUnique({ where: { id: created.id }, include });
  });
  res.status(201).json({ text });
});

// Nouvelle révision : la vérification est remise à zéro, puisque le texte
// vérifié n'est plus celui qui est affiché.
const reviseSchema = z.object({
  content: z.string().min(1).max(2_000_000),
  reason: z.string().trim().min(1).max(1000),
  notes: optionalText(),
  translatorRole: optionalText(300),
});

router.post('/:id/revisions', validateBody(reviseSchema), async (req, res) => {
  const existing = await prisma.textDocument.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Texte introuvable');
  assertCanEdit(req, existing.kind);
  const version = existing.currentVersion + 1;
  const text = await prisma.$transaction(async (tx) => {
    await tx.textRevision.create({
      data: { textId: existing.id, version, content: req.body.content, reason: req.body.reason, authorId: req.user.id },
    });
    await tx.textDocument.update({
      where: { id: existing.id },
      data: {
        currentVersion: version,
        verification: 'UNVERIFIED',
        verifiedById: null,
        verifiedAt: null,
        notes: req.body.notes,
        translatorRole: req.body.translatorRole,
      },
    });
    await audit(req, 'TEXT_REVISED', 'TextDocument', existing.id, { version, reason: req.body.reason }, tx);
    return tx.textDocument.findUnique({ where: { id: existing.id }, include });
  });
  res.json({ text });
});

// Vérification par une autre personne que l'auteur de la révision courante.
router.post('/:id/verify', async (req, res) => {
  const existing = await prisma.textDocument.findUnique({
    where: { id: req.params.id },
    include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!existing) throw notFound('Texte introuvable');
  assertCanEdit(req, existing.kind);
  if (existing.revisions[0]?.authorId === req.user.id) {
    throw forbidden('La vérification doit être faite par une autre personne que l’auteur de la dernière révision');
  }
  const text = await prisma.textDocument.update({
    where: { id: existing.id },
    data: { verification: 'VERIFIED', verifiedById: req.user.id, verifiedAt: new Date() },
    include,
  });
  await audit(req, 'TEXT_VERIFIED', 'TextDocument', existing.id, { version: existing.currentVersion });
  res.json({ text });
});

router.patch('/:id/visibility', validateBody(z.object({ isPublic: z.boolean() })), async (req, res) => {
  if (!can(req, P.CONTENT_EDIT)) throw forbidden();
  const text = await prisma.textDocument.update({ where: { id: req.params.id }, data: req.body, include });
  await audit(req, 'TEXT_VISIBILITY_CHANGED', 'TextDocument', text.id, req.body);
  res.json({ text });
});

export default router;
