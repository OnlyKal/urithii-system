import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { optionalId, optionalText, paginate, paginationSchema, parseQuery } from '../../lib/http.js';
import { parseJson } from '../../lib/text.js';
import { validateBody } from '../../middleware/validate.js';
import { dossierProgress, loadSectionDefs, serializeDef } from '../../services/dossierSchema.js';
import {
  addEvent,
  allowedDossierTransitions,
  canEditDossier,
  canReview,
  DOSSIER_STATUSES,
  dossierInclude,
  findSimilarCommunities,
  loadDossier,
  parseDossierData,
  publishDossier,
  resolveCommunity,
  reviewSection,
  serializeDossier,
  transitionDossier,
} from '../../services/dossiers.js';
import { audit, can, need } from './shared.js';

// Dossiers de collecte : le collecteur remplit le formulaire en étapes et le
// soumet ; l'administrateur vérifie, demande des corrections, valide et publie.
const router = Router();
const P = PERMISSIONS;
const mayCollect = need(P.DOSSIERS_COLLECT, P.DOSSIERS_REVIEW);

// --- Étapes du formulaire --------------------------------------------------

const fieldSchema = z.object({
  key: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/),
  label: z.string().trim().min(1).max(300),
  type: z.enum(['text', 'longtext', 'list', 'select', 'date', 'province', 'territories', 'person', 'consent', 'media', 'sections']),
  help: z.string().max(1000).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
});
const entrySchema = z.object({
  label: z.string().trim().min(1).max(200),
  plural: z.string().trim().max(200).optional(),
  titleField: z.string().trim().min(1).max(60),
  fields: z.array(fieldSchema).min(1).max(60),
});
const defSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9-]{1,59}$/, 'Code : lettres minuscules, chiffres et tirets'),
  title: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  position: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
  categoryId: optionalId,
  // Pas de .default([]) : avec Zod 4, defSchema.partial() l'appliquerait et un
  // PATCH { position } (réordonnancement) viderait les champs de l'étape.
  fields: z.array(fieldSchema).max(80).optional(),
  entry: entrySchema.nullable().optional(),
  mediaHint: optionalText(1000),
  sensitiveNotice: z.boolean().optional(),
});

function checkDef(def) {
  const keys = (def.fields ?? []).map((f) => f.key);
  if (new Set(keys).size !== keys.length) throw badRequest('Clés de champ en double');
  if (def.entry) {
    const entryKeys = def.entry.fields.map((f) => f.key);
    if (new Set(entryKeys).size !== entryKeys.length) throw badRequest('Clés de champ en double');
    if (!entryKeys.includes(def.entry.titleField)) throw badRequest('Données invalides');
  }
}

export const sectionsRouter = Router();

sectionsRouter.get('/', async (req, res) => {
  res.json({ sections: await loadSectionDefs(prisma) });
});

sectionsRouter.post('/', need(P.SETTINGS_MANAGE, P.DOSSIERS_REVIEW), validateBody(defSchema), async (req, res) => {
  checkDef(req.body);
  if (await prisma.dossierSectionDef.findUnique({ where: { key: req.body.key } })) throw conflict('Un élément identique existe déjà');
  const last = await prisma.dossierSectionDef.findFirst({ orderBy: { position: 'desc' } });
  const def = await prisma.dossierSectionDef.create({
    data: {
      ...req.body,
      kind: 'standard',
      position: req.body.position ?? (last?.position ?? 0) + 10,
      fields: JSON.stringify(req.body.fields ?? []),
      entry: req.body.entry ? JSON.stringify(req.body.entry) : null,
    },
  });
  await audit(req, 'REFERENCE_CHANGED', 'DossierSectionDef', def.id, { action: 'create', key: def.key });
  res.status(201).json({ section: serializeDef(def) });
});

sectionsRouter.patch('/:id', need(P.SETTINGS_MANAGE, P.DOSSIERS_REVIEW), validateBody(defSchema.partial()), async (req, res) => {
  const existing = await prisma.dossierSectionDef.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Étape introuvable');
  // Le code et le type d'une étape de référence ne changent pas : les données
  // déjà saisies et la publication en dépendent.
  const { key, ...changes } = req.body;
  if (key && key !== existing.key) throw badRequest('Données invalides');
  const merged = { fields: parseJson(existing.fields, []), entry: parseJson(existing.entry, null), ...changes };
  checkDef(merged);
  const def = await prisma.dossierSectionDef.update({
    where: { id: existing.id },
    data: {
      ...changes,
      fields: changes.fields ? JSON.stringify(changes.fields) : undefined,
      entry: changes.entry === undefined ? undefined : changes.entry ? JSON.stringify(changes.entry) : null,
    },
  });
  await audit(req, 'REFERENCE_CHANGED', 'DossierSectionDef', def.id, { action: 'update', key: def.key });
  res.json({ section: serializeDef(def) });
});

// --- Dossiers ----------------------------------------------------------------

const listQuery = paginationSchema.extend({
  status: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.enum(DOSSIER_STATUSES)).min(1))
    .optional(),
  mine: z.enum(['1']).optional(),
  communityId: z.string().uuid().optional(),
  collectorId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
});

function scopeWhere(req, query = {}) {
  const reviewer = canReview(req.user);
  return {
    AND: [
      reviewer && !query.mine ? {} : { collectorId: req.user.id },
      query.status ? { status: { in: query.status } } : {},
      query.communityId ? { communityId: query.communityId } : {},
      query.collectorId && reviewer ? { collectorId: query.collectorId } : {},
      query.q
        ? { OR: [{ title: { contains: query.q } }, { proposedCommunityName: { contains: query.q } }, { community: { name: { contains: query.q } } }] }
        : {},
    ],
  };
}

const summarize = (d) => {
  const reviews = parseJson(d.reviews, {});
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    progress: d.progress,
    community: d.community,
    proposedCommunityName: d.proposedCommunityName,
    collector: d.collector,
    updatedAt: d.updatedAt,
    submittedAt: d.submittedAt,
    publishedAt: d.publishedAt,
    sectionsToFix: Object.values(reviews).filter((r) => r.status === 'CHANGES_REQUESTED').length,
  };
};

router.get('/', mayCollect, async (req, res) => {
  const query = parseQuery(listQuery, req.query);
  const where = scopeWhere(req, query);
  const [total, dossiers] = await prisma.$transaction([
    prisma.collectionDossier.count({ where }),
    prisma.collectionDossier.findMany({ where, orderBy: { updatedAt: 'desc' }, ...paginate(query), include: dossierInclude }),
  ]);
  res.json({ total, dossiers: dossiers.map(summarize) });
});

// Nombre de dossiers par statut (les siens pour un collecteur).
router.get('/counts', mayCollect, async (req, res) => {
  const grouped = await prisma.collectionDossier.groupBy({ by: ['status'], where: scopeWhere(req), _count: { _all: true } });
  const mine = await prisma.collectionDossier.groupBy({ by: ['status'], where: { collectorId: req.user.id }, _count: { _all: true } });
  const toMap = (rows) => Object.fromEntries(rows.map((g) => [g.status, g._count._all]));
  res.json({ byStatus: toMap(grouped), myByStatus: toMap(mine) });
});

// Suivi des collecteurs : dossiers par statut et dernière activité.
router.get('/stats', need(P.DOSSIERS_REVIEW), async (req, res) => {
  const [users, grouped, activity] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: { in: ['COLLECTEUR', 'RESPONSABLE_COLLECTE'] } } } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, email: true, isActive: true, lastLoginAt: true },
    }),
    prisma.collectionDossier.groupBy({ by: ['collectorId', 'status'], _count: { _all: true } }),
    prisma.collectionDossier.groupBy({ by: ['collectorId'], _max: { updatedAt: true } }),
  ]);
  res.json({
    collectors: users.map((u) => ({
      ...u,
      counts: Object.fromEntries(grouped.filter((g) => g.collectorId === u.id).map((g) => [g.status, g._count._all])),
      lastActivity: activity.find((a) => a.collectorId === u.id)?._max.updatedAt ?? null,
    })),
  });
});

// Communautés existantes portant le même nom qu'une communauté proposée.
router.get('/similar-communities', mayCollect, async (req, res) => {
  const name = z.string().max(200).parse(req.query.name ?? '');
  const similar = await findSimilarCommunities(name);
  res.json({ communities: similar.map((c) => ({ id: c.id, name: c.name })) });
});

const createSchema = z
  .object({
    title: optionalText(300),
    communityId: optionalId,
    proposedCommunityName: optionalText(200),
    missionId: optionalId,
  })
  .refine((v) => v.communityId || v.proposedCommunityName?.trim(), { message: 'Choisissez ou proposez une communauté', path: ['communityId'] });

async function checkCommunityChoice({ communityId, proposedCommunityName }) {
  if (communityId) {
    if (!(await prisma.community.findUnique({ where: { id: communityId } }))) throw notFound('Communauté introuvable');
    return;
  }
  if (proposedCommunityName) {
    const similar = await findSimilarCommunities(proposedCommunityName);
    if (similar.length) {
      throw conflict(`Cette communauté existe déjà : ${similar.map((c) => c.name).join(', ')}`);
    }
  }
}

router.post('/', mayCollect, validateBody(createSchema), async (req, res) => {
  await checkCommunityChoice(req.body);
  const dossier = await prisma.$transaction(async (tx) => {
    const created = await tx.collectionDossier.create({
      data: {
        title: req.body.title,
        communityId: req.body.communityId ?? null,
        proposedCommunityName: req.body.communityId ? null : req.body.proposedCommunityName.trim(),
        missionId: req.body.missionId ?? null,
        collectorId: req.user.id,
        data: JSON.stringify({ sections: {} }),
      },
    });
    await addEvent(tx, created, req.user, { type: 'CREATED' });
    await audit(req, 'DOSSIER_CREATED', 'CollectionDossier', created.id, undefined, tx);
    return created;
  });
  res.status(201).json({ dossier: serializeDossier(dossier) });
});

router.get('/:id', mayCollect, async (req, res) => {
  const dossier = await loadDossier(req.params.id, req.user);
  const [events, versions, items] = await Promise.all([
    prisma.dossierEvent.findMany({ where: { dossierId: dossier.id }, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, displayName: true } } } }),
    prisma.dossierVersion.findMany({
      where: { dossierId: dossier.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, reason: true, createdAt: true, author: { select: { id: true, displayName: true } } },
    }),
    prisma.culturalItem.findMany({
      where: { dossierId: dossier.id },
      select: { id: true, slug: true, title: true, status: true, accessLevel: true, dossierUnit: true, isSensitive: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  res.json({
    dossier: serializeDossier(dossier),
    events,
    versions,
    items,
    transitions: allowedDossierTransitions(req.user, dossier),
    canEdit: canEditDossier(req.user, dossier),
    canReview: canReview(req.user),
  });
});

router.get('/:id/versions/:version', mayCollect, async (req, res) => {
  const dossier = await loadDossier(req.params.id, req.user);
  const version = await prisma.dossierVersion.findUnique({
    where: { dossierId_version: { dossierId: dossier.id, version: Number(req.params.version) || 0 } },
  });
  if (!version) throw notFound('Version introuvable');
  res.json({ version: { ...version, data: parseJson(version.data, { sections: {} }) } });
});

const updateSchema = z.object({
  title: optionalText(300),
  communityId: optionalId,
  proposedCommunityName: optionalText(200),
  missionId: optionalId,
  data: z.unknown().optional(),
});

// Enregistrement (y compris automatique) du contenu du dossier.
router.patch('/:id', mayCollect, validateBody(updateSchema), async (req, res) => {
  const dossier = await loadDossier(req.params.id, req.user);
  if (!canEditDossier(req.user, dossier)) throw forbidden('Vous ne pouvez pas modifier ce dossier à ce stade');
  const changes = {};
  if (req.body.title !== undefined) changes.title = req.body.title;
  if (req.body.missionId !== undefined) changes.missionId = req.body.missionId;
  if (req.body.communityId || req.body.proposedCommunityName) {
    await checkCommunityChoice(req.body);
    changes.communityId = req.body.communityId ?? null;
    changes.proposedCommunityName = req.body.communityId ? null : req.body.proposedCommunityName.trim();
  }
  if (req.body.data !== undefined) {
    const { data, defs } = await parseDossierData(req.body.data, req.user);
    changes.data = JSON.stringify(data);
    changes.progress = dossierProgress(defs, data);
    if (dossier.status === 'DRAFT' && changes.progress > 0) changes.status = 'IN_PROGRESS';
  }
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.collectionDossier.update({ where: { id: dossier.id }, data: changes, include: dossierInclude });
    if (changes.status) await addEvent(tx, saved, req.user, { type: 'TRANSITION', fromStatus: 'DRAFT', toStatus: 'IN_PROGRESS' });
    // Corrections de l'administrateur sur le dossier d'un collecteur : tracées
    // une fois par séance de travail (30 minutes).
    if (canReview(req.user) && dossier.collectorId !== req.user.id && changes.data) {
      const recent = await tx.dossierEvent.findFirst({
        where: { dossierId: dossier.id, type: 'ADMIN_EDIT', authorId: req.user.id, createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
      });
      if (!recent) await addEvent(tx, saved, req.user, { type: 'ADMIN_EDIT' });
    }
    return saved;
  });
  res.json({ dossier: serializeDossier(updated) });
});

router.post(
  '/:id/transitions',
  mayCollect,
  validateBody(z.object({ toStatus: z.enum(DOSSIER_STATUSES), comment: optionalText(5000) })),
  async (req, res) => {
    if (req.body.toStatus === 'PUBLISHED') throw badRequest('Utilisez la publication du dossier');
    const dossier = await transitionDossier(req.params.id, req.body, req.user, req.ip);
    res.json({ dossier: serializeDossier(dossier) });
  },
);

router.put(
  '/:id/reviews/:sectionKey',
  mayCollect,
  validateBody(z.object({ status: z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED']), comment: optionalText(5000) })),
  async (req, res) => {
    const dossier = await reviewSection(req.params.id, req.params.sectionKey, req.body, req.user, req.ip);
    res.json({ dossier: serializeDossier(dossier) });
  },
);

router.post(
  '/:id/comments',
  mayCollect,
  validateBody(z.object({ comment: z.string().trim().min(1).max(5000), sectionKey: optionalText(80) })),
  async (req, res) => {
    const dossier = await loadDossier(req.params.id, req.user);
    const event = await prisma.$transaction((tx) => addEvent(tx, dossier, req.user, { type: 'COMMENT', comment: req.body.comment, sectionKey: req.body.sectionKey ?? null }));
    res.status(201).json({ event });
  },
);

router.post('/:id/community', mayCollect, validateBody(z.object({ communityId: optionalId })), async (req, res) => {
  const dossier = await resolveCommunity(req.params.id, req.body, req.user, req.ip);
  res.json({ dossier: serializeDossier(dossier) });
});

router.post(
  '/:id/publish',
  mayCollect,
  validateBody(z.object({ updateCommunity: z.boolean().optional(), publishCommunity: z.boolean().optional() })),
  async (req, res) => {
    if (!can(req, P.DOSSIERS_REVIEW)) throw forbidden();
    const { dossier, report } = await publishDossier(req.params.id, req.body, req.user, req.ip);
    res.json({ dossier: serializeDossier(dossier), report });
  },
);

export default router;
