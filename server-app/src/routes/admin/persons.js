import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { optionalId, optionalText } from '../../lib/http.js';
import { validateBody } from '../../middleware/validate.js';
import { audit, need } from './shared.js';

// Personnes ressources (§25, §49). Données personnelles : réservées aux
// détenteurs de persons.manage, jamais exposées par l'API publique.
const router = Router();
router.use(need(PERMISSIONS.PERSONS_MANAGE));

const schema = z.object({
  fullName: z.string().trim().min(1).max(300),
  publicName: optionalText(300),
  attributionMode: z.enum(['NAME', 'PSEUDONYM', 'ANONYMOUS']).optional(),
  communityId: optionalId,
  locality: optionalText(300),
  contact: optionalText(1000),
  birthYear: z.coerce.number().int().min(1850).max(2100).nullable().optional(),
  isMinor: z.boolean().optional(),
  guardianName: optionalText(300),
  notes: optionalText(),
});

router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const persons = await prisma.resourcePerson.findMany({
    where: q ? { OR: [{ fullName: { contains: q } }, { publicName: { contains: q } }] } : undefined,
    orderBy: { fullName: 'asc' },
    include: {
      community: { select: { id: true, name: true } },
      _count: { select: { consents: true, items: true } },
    },
  });
  res.json({ persons });
});

router.get('/:id', async (req, res) => {
  const person = await prisma.resourcePerson.findUnique({
    where: { id: req.params.id },
    include: {
      community: { select: { id: true, name: true } },
      consents: { orderBy: { collectedAt: 'desc' } },
      items: { select: { id: true, title: true, status: true } },
    },
  });
  if (!person) throw notFound('Personne introuvable');
  res.json({ person });
});

router.post('/', validateBody(schema), async (req, res) => {
  const person = await prisma.resourcePerson.create({ data: { ...req.body, createdById: req.user.id } });
  await audit(req, 'PERSON_CREATED', 'ResourcePerson', person.id);
  res.status(201).json({ person });
});

router.patch('/:id', validateBody(schema.partial()), async (req, res) => {
  const person = await prisma.resourcePerson.update({ where: { id: req.params.id }, data: req.body });
  await audit(req, 'PERSON_UPDATED', 'ResourcePerson', person.id);
  res.json({ person });
});

router.delete('/:id', async (req, res) => {
  await prisma.resourcePerson.delete({ where: { id: req.params.id } });
  await audit(req, 'PERSON_DELETED', 'ResourcePerson', req.params.id);
  res.status(204).end();
});

export default router;
