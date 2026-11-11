import { Router } from 'express';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { validateBody } from '../../middleware/validate.js';
import { missionPatchSchema, missionSchema, serializeMission, toMissionData } from '../../services/games.js';
import { audit, need } from './shared.js';

// Administration du module Jeux : missions et statistiques d'utilisation.
const router = Router();
router.use(need(PERMISSIONS.GAMES_MANAGE));

const include = { community: { select: { id: true, name: true, slug: true } } };

router.get('/missions', async (req, res) => {
  const missions = await prisma.gameMission.findMany({ orderBy: [{ position: 'asc' }, { title: 'asc' }], include });
  res.json({ missions: missions.map(serializeMission) });
});

router.get('/missions/:id', async (req, res) => {
  const mission = await prisma.gameMission.findUnique({ where: { id: req.params.id }, include });
  if (!mission) throw notFound('Mission introuvable');
  res.json({ mission: serializeMission(mission) });
});

router.post('/missions', validateBody(missionSchema), async (req, res) => {
  const mission = await prisma.gameMission.create({ data: toMissionData(req.body), include });
  await audit(req, 'GAME_MISSION_CREATED', 'GameMission', mission.id, { slug: mission.slug });
  res.status(201).json({ mission: serializeMission(mission) });
});

router.patch('/missions/:id', validateBody(missionPatchSchema), async (req, res) => {
  const current = await prisma.gameMission.findUnique({ where: { id: req.params.id }, select: { builtin: true, slug: true } });
  if (!current) throw notFound('Mission introuvable');
  // L'identifiant d'une mission fournie est référencé par les sauvegardes des joueurs.
  if (current.builtin && req.body.slug && req.body.slug !== current.slug) {
    throw badRequest('L’identifiant d’une mission fournie avec le jeu ne peut pas être modifié');
  }
  const mission = await prisma.gameMission.update({ where: { id: req.params.id }, data: toMissionData(req.body), include });
  await audit(req, 'GAME_MISSION_UPDATED', 'GameMission', mission.id, { status: mission.status });
  res.json({ mission: serializeMission(mission) });
});

router.delete('/missions/:id', async (req, res) => {
  const current = await prisma.gameMission.findUnique({ where: { id: req.params.id }, select: { builtin: true } });
  if (!current) throw notFound('Mission introuvable');
  if (current.builtin) throw badRequest('Une mission fournie avec le jeu ne peut pas être supprimée : désactivez-la');
  await prisma.gameMission.delete({ where: { id: req.params.id } });
  await audit(req, 'GAME_MISSION_DELETED', 'GameMission', req.params.id);
  res.status(204).end();
});

// Statistiques des 30 derniers jours, par jour et par événement.
router.get('/stats', async (req, res) => {
  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const rows = await prisma.gameStat.findMany({ where: { day: { gte: since } }, orderBy: { day: 'asc' } });
  const totals = await prisma.gameStat.groupBy({ by: ['event', 'mission'], _sum: { count: true } });
  res.json({
    since,
    days: rows.map(({ day, event, mission, count }) => ({ day, event, mission, count })),
    totals: totals.map((t) => ({ event: t.event, mission: t.mission, count: t._sum.count ?? 0 })),
  });
});

export default router;
