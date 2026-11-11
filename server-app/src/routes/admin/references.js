import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest } from '../../lib/errors.js';
import { optionalId, optionalText } from '../../lib/http.js';
import { parseJson, toJson, uniqueSlug } from '../../lib/text.js';
import { validateBody } from '../../middleware/validate.js';
import { audit, need } from './shared.js';

// Référentiels : lieux, langues, catégories (§9, §11, §12, §57).
// La suppression n'est possible que pour un élément qui n'est relié à rien ;
// sinon la base refuse (contraintes Restrict) et on propose la désactivation.
const router = Router();
const P = PERMISSIONS;

// ----- Lieux --------------------------------------------------------------

const PLACE_TYPES = ['COUNTRY', 'PROVINCE', 'TERRITORY', 'CITY', 'COMMUNE', 'CHIEFDOM', 'LOCALITY', 'VILLAGE', 'OTHER'];

const placeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(PLACE_TYPES),
  parentId: optionalId,
  notes: optionalText(),
});

router.get('/places', async (req, res) => {
  const places = await prisma.place.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { communities: true, items: true, children: true } } },
  });
  res.json({ places });
});

router.post('/places', need(P.COMMUNITIES_MANAGE), validateBody(placeSchema), async (req, res) => {
  const place = await prisma.place.create({ data: req.body });
  await audit(req, 'PLACE_CREATED', 'Place', place.id);
  res.status(201).json({ place });
});

async function assertNoPlaceCycle(id, parentId) {
  for (let current = parentId; current; ) {
    if (current === id) throw badRequest('Un lieu ne peut pas être contenu dans lui-même');
    current = (await prisma.place.findUnique({ where: { id: current }, select: { parentId: true } }))?.parentId;
  }
}

router.patch('/places/:id', need(P.COMMUNITIES_MANAGE), validateBody(placeSchema.partial()), async (req, res) => {
  if (req.body.parentId) await assertNoPlaceCycle(req.params.id, req.body.parentId);
  const place = await prisma.place.update({ where: { id: req.params.id }, data: req.body });
  await audit(req, 'PLACE_UPDATED', 'Place', place.id);
  res.json({ place });
});

router.delete('/places/:id', need(P.COMMUNITIES_MANAGE), async (req, res) => {
  await prisma.place.delete({ where: { id: req.params.id } });
  await audit(req, 'PLACE_DELETED', 'Place', req.params.id);
  res.status(204).end();
});

// ----- Langues ------------------------------------------------------------

const languageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isoCode: optionalText(10),
  parentId: optionalId,
  notes: optionalText(),
});

router.get('/languages', async (req, res) => {
  const languages = await prisma.language.findMany({
    orderBy: { name: 'asc' },
    include: { parent: { select: { id: true, name: true } }, _count: { select: { communities: true, items: true } } },
  });
  res.json({ languages });
});

router.post('/languages', need(P.COMMUNITIES_MANAGE), validateBody(languageSchema), async (req, res) => {
  const language = await prisma.language.create({ data: req.body });
  await audit(req, 'LANGUAGE_CREATED', 'Language', language.id);
  res.status(201).json({ language });
});

router.patch('/languages/:id', need(P.COMMUNITIES_MANAGE), validateBody(languageSchema.partial()), async (req, res) => {
  if (req.body.parentId === req.params.id) throw badRequest('Une langue ne peut pas être sa propre variante');
  const language = await prisma.language.update({ where: { id: req.params.id }, data: req.body });
  await audit(req, 'LANGUAGE_UPDATED', 'Language', language.id);
  res.json({ language });
});

router.delete('/languages/:id', need(P.COMMUNITIES_MANAGE), async (req, res) => {
  await prisma.language.delete({ where: { id: req.params.id } });
  await audit(req, 'LANGUAGE_DELETED', 'Language', req.params.id);
  res.status(204).end();
});

// ----- Catégories ---------------------------------------------------------

export const FIELD_TYPES = ['text', 'longtext', 'list'];

const fieldDefinition = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'Clé : lettres et chiffres, commençant par une minuscule'),
  label: z.string().trim().min(1).max(200),
  type: z.enum(FIELD_TYPES),
  help: optionalText(500),
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalText(),
  code: optionalText(10),
  parentId: optionalId,
  position: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  fieldsSchema: z
    .array(fieldDefinition)
    .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, 'Clés de champ en double')
    .optional(),
});

const serializeCategory = (c) => ({ ...c, fieldsSchema: parseJson(c.fieldsSchema, []) });

router.get('/categories', async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true, children: true } } },
  });
  res.json({ categories: categories.map(serializeCategory) });
});

router.post('/categories', need(P.CATEGORIES_MANAGE), validateBody(categorySchema), async (req, res) => {
  const { fieldsSchema, ...data } = req.body;
  const category = await prisma.category.create({
    data: { ...data, slug: await uniqueSlug(prisma.category, data.name), fieldsSchema: toJson(fieldsSchema) },
  });
  await audit(req, 'CATEGORY_CREATED', 'Category', category.id);
  res.status(201).json({ category: serializeCategory(category) });
});

router.patch('/categories/:id', need(P.CATEGORIES_MANAGE), validateBody(categorySchema.partial()), async (req, res) => {
  const { fieldsSchema, ...data } = req.body;
  if (data.parentId === req.params.id) throw badRequest('Une catégorie ne peut pas être sa propre sous-catégorie');
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { ...data, ...(fieldsSchema !== undefined && { fieldsSchema: toJson(fieldsSchema) }) },
  });
  await audit(req, 'CATEGORY_UPDATED', 'Category', category.id, { isActive: data.isActive });
  res.json({ category: serializeCategory(category) });
});

router.delete('/categories/:id', need(P.CATEGORIES_MANAGE), async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  await audit(req, 'CATEGORY_DELETED', 'Category', req.params.id);
  res.status(204).end();
});

export default router;
