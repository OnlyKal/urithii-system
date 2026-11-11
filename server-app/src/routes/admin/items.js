import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, forbidden, HttpError, notFound } from '../../lib/errors.js';
import { optionalDate, optionalId, optionalText, paginate, paginationSchema, parseQuery } from '../../lib/http.js';
import { parseJson } from '../../lib/text.js';
import { validateBody } from '../../middleware/validate.js';
import { canEditItem, internalItemWhere } from '../../services/access.js';
import { createItem, loadItemForUser, publicationProblems, restoreVersion, updateItem } from '../../services/items.js';
import { allowedTransitions, commentItem, STATUSES, transitionItem } from '../../services/workflow.js';
import { audit, can, need } from './shared.js';

// Fiches culturelles : édition, versions, validation, relations, accès (§18 à §23, §39 à §45, §47).
const router = Router();
const P = PERMISSIONS;

const ACCESS_LEVELS = ['PUBLIC', 'CONTRIBUTORS', 'TEAM', 'SPECIAL', 'PRIVATE'];
const VERIFICATION = ['SOURCED', 'TESTIMONY', 'ORAL_TRADITION', 'CORROBORATED', 'CONTESTED', 'HYPOTHESIS', 'INCOMPLETE'];

const fieldValue = z.union([z.string().max(100_000), z.array(z.string().max(10_000)).max(500)]);

const itemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  originalTitle: optionalText(300),
  summary: optionalText(3000),
  body: optionalText(500_000),
  fields: z.record(z.string(), fieldValue).optional(),
  keywords: optionalText(2000),
  categoryId: z.string().uuid(),
  originalLanguageId: optionalId,
  dateKind: z.enum(['EXACT', 'APPROXIMATE', 'PERIOD', 'UNKNOWN']).optional(),
  dateValue: optionalText(100),
  dateEnd: optionalText(100),
  verificationStatus: z.enum(VERIFICATION).optional(),
  accessLevel: z.enum(ACCESS_LEVELS).optional(),
  isSensitive: z.boolean().optional(),
  resourcePersonId: optionalId,
  missionId: optionalId,
  communityIds: z.array(z.string().uuid()).max(50).optional(),
  placeIds: z.array(z.string().uuid()).max(100).optional(),
  sources: z
    .array(z.object({ sourceId: z.string().uuid(), supports: optionalText(2000), locator: optionalText(500) }))
    .max(200)
    .optional(),
  media: z
    .array(z.object({ mediaId: z.string().uuid(), position: z.number().int().min(0).optional(), caption: optionalText(1000) }))
    .max(200)
    .optional(),
  consentIds: z.array(z.string().uuid()).max(100).optional(),
  reason: optionalText(1000),
  publicNote: optionalText(1000),
});

// Vérifie que les champs spécialisés correspondent au schéma de la catégorie.
async function validateFields(categoryId, fields) {
  if (!fields) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw badRequest('Catégorie introuvable');
  const allowed = new Map(parseJson(category.fieldsSchema, []).map((f) => [f.key, f]));
  for (const [key, value] of Object.entries(fields)) {
    const definition = allowed.get(key);
    if (!definition) throw badRequest(`Champ « ${key} » non prévu pour cette catégorie`);
    if (definition.type === 'list' ? !Array.isArray(value) : typeof value !== 'string') {
      throw badRequest(`Format incorrect pour le champ « ${definition.label} »`);
    }
  }
}

// Rendre public un contenu déjà publié l'exposerait immédiatement : cela
// exige la permission de publication et le respect des conditions (§39).
async function assertAccessChangeAllowed(req, item, accessLevel) {
  if (!accessLevel || accessLevel === item.accessLevel) return;
  if (item.publishedVersionId && accessLevel === 'PUBLIC') {
    if (!can(req, P.CONTENT_PUBLISH)) throw forbidden('Seul un éditeur habilité peut rendre public un contenu publié');
    const problems = publicationProblems({ ...item, accessLevel });
    if (problems.length) throw new HttpError(422, 'Publication impossible', problems.map((message) => ({ message })));
  }
}

const listQuery = paginationSchema.extend({
  q: z.string().optional(),
  // Un ou plusieurs statuts séparés par des virgules (files de travail regroupées).
  status: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.enum(STATUSES)).min(1).max(STATUSES.length))
    .optional(),
  categoryId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
  mine: z.enum(['1']).optional(),
});

router.get('/', async (req, res) => {
  const query = parseQuery(listQuery, req.query);
  const where = {
    AND: [
      internalItemWhere(req.user),
      {
        ...(query.status && { status: { in: query.status } }),
        categoryId: query.categoryId,
        createdById: query.mine ? req.user.id : undefined,
        ...(query.communityId && { communities: { some: { communityId: query.communityId } } }),
        ...(query.q && { OR: [{ title: { contains: query.q } }, { originalTitle: { contains: query.q } }] }),
      },
    ],
  };
  const [total, items] = await prisma.$transaction([
    prisma.culturalItem.count({ where }),
    prisma.culturalItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      ...paginate(query),
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        accessLevel: true,
        isSensitive: true,
        currentVersion: true,
        publishedVersionId: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        communities: { select: { community: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, displayName: true } },
      },
    }),
  ]);
  res.json({ total, items });
});

router.post('/', need(P.CONTENT_CREATE, P.CONTENT_EDIT), validateBody(itemSchema), async (req, res) => {
  await validateFields(req.body.categoryId, req.body.fields);
  const item = await createItem(req.body, req.user, req.ip);
  res.status(201).json({ item });
});

router.get('/:id', async (req, res) => {
  const item = await loadItemForUser(req.params.id, req.user);
  const [decisions, relations, versions] = await Promise.all([
    prisma.validationDecision.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, displayName: true } } },
    }),
    prisma.itemRelation.findMany({
      where: { OR: [{ fromId: item.id }, { toId: item.id }] },
      include: {
        from: { select: { id: true, title: true, status: true } },
        to: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.itemVersion.findMany({
      where: { itemId: item.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, reason: true, publicNote: true, createdAt: true, publishedAt: true, author: { select: { id: true, displayName: true } } },
    }),
  ]);
  res.json({
    item: { ...item, fields: parseJson(item.fields, {}) },
    canEdit: canEditItem(req.user, item),
    transitions: await allowedTransitions(req.user, item),
    publicationProblems: publicationProblems(item),
    decisions,
    relations,
    versions,
  });
});

router.patch('/:id', validateBody(itemSchema.partial()), async (req, res) => {
  const existing = await loadItemForUser(req.params.id, req.user);
  await validateFields(req.body.categoryId ?? existing.categoryId, req.body.fields);
  await assertAccessChangeAllowed(req, existing, req.body.accessLevel);
  const item = await updateItem(req.params.id, req.body, req.user, req.ip);
  if (req.body.accessLevel && req.body.accessLevel !== existing.accessLevel) {
    await audit(req, 'ITEM_ACCESS_CHANGED', 'CulturalItem', item.id, { from: existing.accessLevel, to: req.body.accessLevel });
  }
  res.json({ item });
});

// ----- Versions -----------------------------------------------------------

router.get('/:id/versions/:version', async (req, res) => {
  await loadItemForUser(req.params.id, req.user);
  const version = await prisma.itemVersion.findUnique({
    where: { itemId_version: { itemId: req.params.id, version: Number(req.params.version) } },
    include: { author: { select: { id: true, displayName: true } } },
  });
  if (!version) throw notFound('Version introuvable');
  res.json({ version: { ...version, snapshot: JSON.parse(version.snapshot) } });
});

router.post('/:id/versions/:version/restore', async (req, res) => {
  const item = await restoreVersion(req.params.id, Number(req.params.version), req.user, req.ip);
  res.json({ item });
});

// ----- Validation ---------------------------------------------------------

const transitionSchema = z.object({
  toStatus: z.enum(STATUSES),
  reason: optionalText(2000),
  comments: optionalText(5000),
  requestedChanges: optionalText(5000),
  scheduledAt: optionalDate,
});

router.post('/:id/transitions', validateBody(transitionSchema), async (req, res) => {
  const item = await transitionItem(req.params.id, req.body, req.user, req.ip);
  res.json({ item });
});

router.post(
  '/:id/comments',
  validateBody(z.object({ comments: z.string().trim().min(1).max(5000) })),
  async (req, res) => {
    const decision = await commentItem(req.params.id, req.body, req.user, req.ip);
    res.status(201).json({ decision });
  },
);

// ----- Relations entre fiches (§15, §42) ----------------------------------

const RELATION_TYPES = ['RELATED', 'VARIANT_OF', 'PART_OF', 'INGREDIENT', 'INSTRUMENT', 'COSTUME', 'SONG', 'CONTEXT', 'TESTIMONY_FOR'];

router.post(
  '/:id/relations',
  validateBody(z.object({ toId: z.string().uuid(), type: z.enum(RELATION_TYPES), notes: optionalText(2000) })),
  async (req, res) => {
    const item = await loadItemForUser(req.params.id, req.user);
    if (!canEditItem(req.user, item)) throw forbidden();
    if (req.body.toId === item.id) throw badRequest('Une fiche ne peut pas être reliée à elle-même');
    await loadItemForUser(req.body.toId, req.user);
    const relation = await prisma.itemRelation.create({ data: { fromId: item.id, ...req.body } });
    await audit(req, 'ITEM_RELATION_ADDED', 'CulturalItem', item.id, { toId: req.body.toId, type: req.body.type });
    res.status(201).json({ relation });
  },
);

router.delete('/:id/relations/:relationId', async (req, res) => {
  const item = await loadItemForUser(req.params.id, req.user);
  if (!canEditItem(req.user, item)) throw forbidden();
  const relation = await prisma.itemRelation.findUnique({ where: { id: req.params.relationId } });
  if (!relation || (relation.fromId !== item.id && relation.toId !== item.id)) throw notFound('Relation introuvable');
  await prisma.itemRelation.delete({ where: { id: relation.id } });
  await audit(req, 'ITEM_RELATION_REMOVED', 'CulturalItem', item.id, { relationId: relation.id });
  res.status(204).end();
});

// ----- Accès nominatifs (§47) ---------------------------------------------

router.post(
  '/:id/grants',
  need(P.CONTENT_EDIT, P.SETTINGS_MANAGE),
  validateBody(z.object({ userId: z.string().uuid(), reason: optionalText(1000), expiresAt: optionalDate })),
  async (req, res) => {
    const item = await loadItemForUser(req.params.id, req.user);
    const grant = await prisma.accessGrant.upsert({
      where: { itemId_userId: { itemId: item.id, userId: req.body.userId } },
      create: { itemId: item.id, ...req.body, grantedById: req.user.id },
      update: { reason: req.body.reason, expiresAt: req.body.expiresAt, grantedById: req.user.id },
    });
    await audit(req, 'ITEM_ACCESS_GRANTED', 'CulturalItem', item.id, { userId: req.body.userId, expiresAt: req.body.expiresAt });
    res.status(201).json({ grant });
  },
);

router.delete('/:id/grants/:userId', need(P.CONTENT_EDIT, P.SETTINGS_MANAGE), async (req, res) => {
  const item = await loadItemForUser(req.params.id, req.user);
  await prisma.accessGrant.delete({ where: { itemId_userId: { itemId: item.id, userId: req.params.userId } } });
  await audit(req, 'ITEM_ACCESS_REVOKED', 'CulturalItem', item.id, { userId: req.params.userId });
  res.status(204).end();
});

export default router;
