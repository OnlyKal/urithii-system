import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseJson } from '../../lib/text.js';

// Listes légères pour alimenter les formulaires de l'administration.
const router = Router();

router.get('/', async (req, res) => {
  const [categories, communities, places, languages, users, questionnaires] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    prisma.community.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.place.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true, parentId: true } }),
    prisma.language.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, isoCode: true } }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, roles: { select: { role: true } } },
    }),
    prisma.questionnaire.findMany({ where: { isActive: true }, orderBy: { title: 'asc' }, select: { id: true, title: true } }),
  ]);
  res.json({
    categories: categories.map((c) => ({ ...c, fieldsSchema: parseJson(c.fieldsSchema, []) })),
    communities,
    places,
    languages,
    users: users.map((u) => ({ id: u.id, displayName: u.displayName, roles: u.roles.map((r) => r.role) })),
    questionnaires,
  });
});

export default router;
