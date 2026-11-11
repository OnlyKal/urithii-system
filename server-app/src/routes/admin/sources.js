import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { optionalText, paginate, paginationSchema, parseQuery } from '../../lib/http.js';
import { validateBody } from '../../middleware/validate.js';
import { audit, need } from './shared.js';

// Registre des sources (§60, §61).
const router = Router();

const SOURCE_TYPES = [
  'BOOK', 'ARTICLE', 'THESIS', 'ARCHIVE', 'REPORT', 'PHOTOGRAPH', 'TESTIMONY',
  'RECORDING', 'ADMINISTRATIVE', 'WEBSITE', 'COLLECTION', 'FIELDWORK', 'OTHER',
];

const schema = z.object({
  type: z.enum(SOURCE_TYPES),
  title: z.string().trim().min(1).max(500),
  author: optionalText(500),
  date: optionalText(100),
  publisher: optionalText(500),
  provenance: optionalText(1000),
  reference: optionalText(2000),
  url: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(2000).nullable().optional()),
  rights: optionalText(2000),
  status: z.enum(['ACTIVE', 'CONTESTED', 'UNAVAILABLE', 'REPLACED']).optional(),
  statusNote: optionalText(2000),
  isPublic: z.boolean().optional(),
  notes: optionalText(),
});

const listQuery = paginationSchema.extend({
  q: z.string().optional(),
  status: z.enum(['ACTIVE', 'CONTESTED', 'UNAVAILABLE', 'REPLACED']).optional(),
});

router.get('/', async (req, res) => {
  const query = parseQuery(listQuery, req.query);
  const where = {
    status: query.status,
    ...(query.q && { OR: [{ title: { contains: query.q } }, { author: { contains: query.q } }] }),
  };
  const [total, sources] = await prisma.$transaction([
    prisma.source.count({ where }),
    prisma.source.findMany({
      where,
      orderBy: { title: 'asc' },
      ...paginate(query),
      include: { _count: { select: { items: true } } },
    }),
  ]);
  res.json({ total, sources });
});

// Fiche d'une source avec les contenus qu'elle étaye : permet d'identifier
// les contenus concernés si la source est contestée ou remplacée (§61).
router.get('/:id', async (req, res) => {
  const source = await prisma.source.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { item: { select: { id: true, title: true, status: true } } } },
      communityNames: { include: { community: { select: { id: true, name: true } } } },
    },
  });
  if (!source) throw notFound('Source introuvable');
  res.json({ source });
});

router.post('/', need(PERMISSIONS.SOURCES_MANAGE), validateBody(schema), async (req, res) => {
  const source = await prisma.source.create({ data: req.body });
  await audit(req, 'SOURCE_CREATED', 'Source', source.id);
  res.status(201).json({ source });
});

router.patch('/:id', need(PERMISSIONS.SOURCES_MANAGE), validateBody(schema.partial()), async (req, res) => {
  const source = await prisma.source.update({ where: { id: req.params.id }, data: req.body });
  await audit(req, 'SOURCE_UPDATED', 'Source', source.id, req.body.status ? { status: req.body.status } : undefined);
  res.json({ source });
});

router.delete('/:id', need(PERMISSIONS.SOURCES_MANAGE), async (req, res) => {
  await prisma.source.delete({ where: { id: req.params.id } });
  await audit(req, 'SOURCE_DELETED', 'Source', req.params.id);
  res.status(204).end();
});

export default router;
