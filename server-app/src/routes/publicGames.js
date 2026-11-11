import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { validateBody } from '../middleware/validate.js';
import { GAME_EVENTS, serializeMission, today } from '../services/games.js';

// API publique du module Jeux : missions publiées et statistiques anonymes.
// La progression des joueurs reste dans leur navigateur : aucune donnée
// personnelle n'est envoyée.
const router = Router();

router.get('/missions', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  const missions = await prisma.gameMission.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ position: 'asc' }, { title: 'asc' }],
    include: { community: { select: { id: true, name: true, slug: true, isPublished: true } } },
  });
  res.json({
    missions: missions.map((m) => {
      const { builtin, status, createdAt, updatedAt, communityId, ...rest } = serializeMission(m);
      // Une communauté non publiée n'est pas exposée.
      return { ...rest, community: m.community?.isPublished ? rest.community : null };
    }),
  });
});

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Trop de requêtes' },
});

const eventSchema = z.object({
  event: z.enum(GAME_EVENTS),
  mission: z.string().trim().max(80).regex(/^[a-z0-9-]*$/).optional(),
});

router.post('/events', eventLimiter, validateBody(eventSchema), async (req, res) => {
  const key = { day: today(), event: req.body.event, mission: req.body.mission ?? '' };
  await prisma.gameStat.upsert({
    where: { day_event_mission: key },
    create: { ...key, count: 1 },
    update: { count: { increment: 1 } },
  });
  res.status(204).end();
});

export default router;
