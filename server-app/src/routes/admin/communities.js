import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { optionalId, optionalText } from '../../lib/http.js';
import { normalizeSearch, uniqueSlug } from '../../lib/text.js';
import { validateBody } from '../../middleware/validate.js';
import { applyImport, countActions, planImport, readImportFile, summarizePlan } from '../../services/communityImport.js';
import { audit, need } from './shared.js';

// Gestion des communautés (§10, §57). Une communauté peut être liée à
// plusieurs lieux et langues (§9) ; chaque dénomination ou localisation peut
// citer sa source.
const router = Router();

const include = {
  names: { include: { source: { select: { id: true, title: true } } }, orderBy: { name: 'asc' } },
  places: { include: { place: true, source: { select: { id: true, title: true } } } },
  languages: { include: { language: true } },
  _count: { select: { items: true, missions: true, persons: true } },
};

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  summary: optionalText(2000),
  description: optionalText(),
  history: optionalText(),
  documentationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'ADVANCED']).optional(),
  documentationNote: optionalText(2000),
  isPublished: z.boolean().optional(),
  names: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        kind: z.enum(['PRIMARY', 'AUTONYM', 'EXONYM', 'HISTORICAL', 'VARIANT']),
        notes: optionalText(1000),
        sourceId: optionalId,
      }),
    )
    .optional(),
  places: z.array(z.object({ placeId: z.string().uuid(), notes: optionalText(1000), sourceId: optionalId })).optional(),
  languages: z.array(z.object({ languageId: z.string().uuid(), notes: optionalText(1000) })).optional(),
});

function searchTextFor(community, names) {
  return normalizeSearch([community.name, community.summary, ...names.map((n) => n.name)].join(' '));
}

async function save(tx, id, data) {
  const { names, places, languages, ...fields } = data;
  if (names) {
    await tx.communityName.deleteMany({ where: { communityId: id } });
    await tx.communityName.createMany({ data: names.map((n) => ({ ...n, communityId: id })) });
  }
  if (places) {
    await tx.communityPlace.deleteMany({ where: { communityId: id } });
    await tx.communityPlace.createMany({ data: places.map((p) => ({ ...p, communityId: id })) });
  }
  if (languages) {
    await tx.communityLanguage.deleteMany({ where: { communityId: id } });
    await tx.communityLanguage.createMany({ data: languages.map((l) => ({ ...l, communityId: id })) });
  }
  const community = await tx.community.update({ where: { id }, data: fields, include });
  return tx.community.update({
    where: { id },
    data: { searchText: searchTextFor(community, community.names) },
    include,
  });
}

router.get('/', async (req, res) => {
  const communities = await prisma.community.findMany({ orderBy: { name: 'asc' }, include });
  res.json({ communities });
});

// Import depuis un fichier JSON : analyse (dryRun) puis import.
router.post(
  '/import',
  need(PERMISSIONS.COMMUNITIES_MANAGE),
  validateBody(z.object({ data: z.unknown(), mode: z.enum(['skip', 'update']).default('skip'), dryRun: z.boolean().default(true) })),
  async (req, res) => {
    const list = readImportFile(req.body.data);
    const plan = await planImport(list, { mode: req.body.mode });
    const results = req.body.dryRun ? summarizePlan(plan) : await applyImport(plan, req.user, req.ip);
    res.json({ dryRun: req.body.dryRun, counts: countActions(results), results });
  },
);

router.get('/:id', async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id }, include });
  if (!community) throw notFound('Communauté introuvable');
  res.json({ community });
});

router.post('/', need(PERMISSIONS.COMMUNITIES_MANAGE), validateBody(schema), async (req, res) => {
  const community = await prisma.$transaction(async (tx) => {
    const created = await tx.community.create({
      data: { name: req.body.name, slug: await uniqueSlug(tx.community, req.body.name) },
    });
    const saved = await save(tx, created.id, req.body);
    await audit(req, 'COMMUNITY_CREATED', 'Community', created.id, undefined, tx);
    return saved;
  });
  res.status(201).json({ community });
});

router.patch('/:id', need(PERMISSIONS.COMMUNITIES_MANAGE), validateBody(schema.partial()), async (req, res) => {
  const community = await prisma.$transaction(async (tx) => {
    const before = await tx.community.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('Communauté introuvable');
    const saved = await save(tx, req.params.id, req.body);
    const published = req.body.isPublished !== undefined && req.body.isPublished !== before.isPublished;
    await audit(
      req,
      published ? (req.body.isPublished ? 'COMMUNITY_PUBLISHED' : 'COMMUNITY_UNPUBLISHED') : 'COMMUNITY_UPDATED',
      'Community',
      req.params.id,
      undefined,
      tx,
    );
    return saved;
  });
  res.json({ community });
});

// Suppression encadrée (§57) : refusée dès qu'un contenu, une mission ou une
// personne ressource est rattaché.
router.delete('/:id', need(PERMISSIONS.COMMUNITIES_MANAGE), async (req, res) => {
  await prisma.community.delete({ where: { id: req.params.id } });
  await audit(req, 'COMMUNITY_DELETED', 'Community', req.params.id);
  res.status(204).end();
});

export default router;
