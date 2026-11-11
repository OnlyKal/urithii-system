import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { optionalDate, optionalId, optionalText } from '../../lib/http.js';
import { parseJson, slugify, toJson, uniqueSlug } from '../../lib/text.js';
import { validateBody } from '../../middleware/validate.js';
import { isSuperAdmin } from '../../services/access.js';
import { audit, can, need } from './shared.js';

// Missions de collecte et questionnaires (§24 à §27, §33, §34).
const router = Router();
const P = PERMISSIONS;

const MISSION_STATUSES = ['PLANNED', 'PREPARATION', 'IN_PROGRESS', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

const missionInclude = {
  community: { select: { id: true, name: true } },
  place: true,
  responsible: { select: { id: true, displayName: true } },
  members: { include: { user: { select: { id: true, displayName: true, email: true } } } },
  resourcePersons: { include: { resourcePerson: { select: { id: true, fullName: true, publicName: true } } } },
  questionnaires: { include: { questionnaire: true } },
  notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, displayName: true } } } },
  reports: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, displayName: true } } } },
  _count: { select: { items: true, media: true, consents: true } },
};

const isMember = (mission, user) =>
  mission.responsibleId === user.id || mission.members.some((m) => m.userId === user.id);

// Gestion : super administrateur, ou détenteur de missions.manage
// responsable de la mission (§33 : « les missions qui lui sont confiées »).
const canManage = (mission, user) =>
  isSuperAdmin(user) || (user.permissions.includes(P.MISSIONS_MANAGE) && mission.responsibleId === user.id);

async function loadMission(id, user) {
  const mission = await prisma.mission.findUnique({ where: { id }, include: missionInclude });
  if (!mission) throw notFound('Mission introuvable');
  if (!isSuperAdmin(user) && !user.permissions.includes(P.MISSIONS_MANAGE) && !isMember(mission, user)) {
    throw notFound('Mission introuvable');
  }
  return mission;
}

const serialize = (m) => ({ ...m, categoryIds: parseJson(m.categoryIds, []) });

const missionSchema = z.object({
  title: z.string().trim().min(1).max(300),
  objective: z.string().trim().min(1).max(5000),
  communityId: optionalId,
  placeId: optionalId,
  categoryIds: z.array(z.string().uuid()).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  responsibleId: z.string().uuid().optional(),
  status: z.enum(MISSION_STATUSES).optional(),
  requiredDocuments: optionalText(),
  safetyGuidelines: optionalText(),
  expectedResults: optionalText(),
  budget: optionalText(2000),
  difficulties: optionalText(),
});

router.get('/', need(P.MISSIONS_MANAGE, P.MISSIONS_PARTICIPATE), async (req, res) => {
  const where =
    isSuperAdmin(req.user) || can(req, P.MISSIONS_MANAGE)
      ? {}
      : { OR: [{ responsibleId: req.user.id }, { members: { some: { userId: req.user.id } } }] };
  const missions = await prisma.mission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      community: { select: { id: true, name: true } },
      responsible: { select: { id: true, displayName: true } },
      _count: { select: { members: true, items: true, media: true } },
    },
  });
  res.json({ missions: missions.map(serialize) });
});

router.get('/:id', async (req, res) => {
  res.json({ mission: serialize(await loadMission(req.params.id, req.user)) });
});

router.post('/', need(P.MISSIONS_MANAGE), validateBody(missionSchema), async (req, res) => {
  const { categoryIds, ...data } = req.body;
  const year = new Date().getFullYear();
  const code = `MIS-${year}-${slugify(data.title).slice(0, 20).replace(/-+$/, '').toUpperCase()}`;
  const mission = await prisma.mission.create({
    data: {
      ...data,
      code: await uniqueCode(code),
      responsibleId: data.responsibleId ?? req.user.id,
      categoryIds: toJson(categoryIds),
    },
    include: missionInclude,
  });
  await audit(req, 'MISSION_CREATED', 'Mission', mission.id);
  res.status(201).json({ mission: serialize(mission) });
});

async function uniqueCode(base) {
  for (let i = 1; ; i++) {
    const code = i === 1 ? base : `${base}-${i}`;
    if (!(await prisma.mission.findUnique({ where: { code } }))) return code;
  }
}

router.patch('/:id', validateBody(missionSchema.partial()), async (req, res) => {
  const mission = await loadMission(req.params.id, req.user);
  if (!canManage(mission, req.user)) throw forbidden();
  const { categoryIds, ...data } = req.body;
  const closing = data.status && ['COMPLETED', 'CANCELLED'].includes(data.status) && !mission.closedAt;
  const updated = await prisma.mission.update({
    where: { id: mission.id },
    data: {
      ...data,
      ...(categoryIds !== undefined && { categoryIds: toJson(categoryIds) }),
      ...(closing && { closedAt: new Date() }),
    },
    include: missionInclude,
  });
  await audit(req, closing ? 'MISSION_CLOSED' : 'MISSION_UPDATED', 'Mission', mission.id, data.status ? { status: data.status } : undefined);
  res.json({ mission: serialize(updated) });
});

// ----- Équipe, personnes ressources, questionnaires -------------------------

router.post(
  '/:id/members',
  validateBody(z.object({ userId: z.string().uuid(), role: z.string().trim().max(50).optional() })),
  async (req, res) => {
    const mission = await loadMission(req.params.id, req.user);
    if (!canManage(mission, req.user)) throw forbidden();
    await prisma.missionMember.upsert({
      where: { missionId_userId: { missionId: mission.id, userId: req.body.userId } },
      create: { missionId: mission.id, userId: req.body.userId, role: req.body.role ?? 'COLLECTEUR' },
      update: { role: req.body.role ?? 'COLLECTEUR' },
    });
    await audit(req, 'MISSION_MEMBER_ADDED', 'Mission', mission.id, { userId: req.body.userId });
    res.status(201).json({ mission: serialize(await loadMission(mission.id, req.user)) });
  },
);

router.delete('/:id/members/:userId', async (req, res) => {
  const mission = await loadMission(req.params.id, req.user);
  if (!canManage(mission, req.user)) throw forbidden();
  await prisma.missionMember.delete({ where: { missionId_userId: { missionId: mission.id, userId: req.params.userId } } });
  await audit(req, 'MISSION_MEMBER_REMOVED', 'Mission', mission.id, { userId: req.params.userId });
  res.status(204).end();
});

router.post(
  '/:id/persons',
  validateBody(z.object({ resourcePersonId: z.string().uuid() })),
  async (req, res) => {
    const mission = await loadMission(req.params.id, req.user);
    if (!canManage(mission, req.user) && !(isMember(mission, req.user) && can(req, P.PERSONS_MANAGE))) throw forbidden();
    await prisma.missionResourcePerson.upsert({
      where: { missionId_resourcePersonId: { missionId: mission.id, resourcePersonId: req.body.resourcePersonId } },
      create: { missionId: mission.id, resourcePersonId: req.body.resourcePersonId },
      update: {},
    });
    await audit(req, 'MISSION_PERSON_ADDED', 'Mission', mission.id);
    res.status(201).json({ mission: serialize(await loadMission(mission.id, req.user)) });
  },
);

router.post(
  '/:id/questionnaires',
  validateBody(z.object({ questionnaireId: z.string().uuid() })),
  async (req, res) => {
    const mission = await loadMission(req.params.id, req.user);
    if (!canManage(mission, req.user)) throw forbidden();
    await prisma.missionQuestionnaire.upsert({
      where: { missionId_questionnaireId: { missionId: mission.id, questionnaireId: req.body.questionnaireId } },
      create: { missionId: mission.id, questionnaireId: req.body.questionnaireId },
      update: {},
    });
    res.status(201).json({ mission: serialize(await loadMission(mission.id, req.user)) });
  },
);

router.delete('/:id/questionnaires/:questionnaireId', async (req, res) => {
  const mission = await loadMission(req.params.id, req.user);
  if (!canManage(mission, req.user)) throw forbidden();
  await prisma.missionQuestionnaire.delete({
    where: { missionId_questionnaireId: { missionId: mission.id, questionnaireId: req.params.questionnaireId } },
  });
  res.status(204).end();
});

// ----- Notes de terrain et rapports ---------------------------------------

router.post(
  '/:id/notes',
  validateBody(z.object({ content: z.string().trim().min(1).max(50_000), unverified: optionalText(10_000) })),
  async (req, res) => {
    const mission = await loadMission(req.params.id, req.user);
    if (!isMember(mission, req.user) && !canManage(mission, req.user)) throw forbidden();
    const note = await prisma.fieldNote.create({ data: { missionId: mission.id, authorId: req.user.id, ...req.body } });
    await audit(req, 'FIELD_NOTE_ADDED', 'Mission', mission.id);
    res.status(201).json({ note });
  },
);

const reportSchema = z.object({
  summary: z.string().trim().min(1).max(50_000),
  results: optionalText(50_000),
  difficulties: optionalText(50_000),
  submit: z.boolean().optional(),
});

router.post('/:id/reports', validateBody(reportSchema), async (req, res) => {
  const mission = await loadMission(req.params.id, req.user);
  if (!isMember(mission, req.user) && !canManage(mission, req.user)) throw forbidden();
  const { submit, ...data } = req.body;
  const report = await prisma.missionReport.create({
    data: {
      ...data,
      missionId: mission.id,
      authorId: req.user.id,
      status: submit ? 'SUBMITTED' : 'DRAFT',
      submittedAt: submit ? new Date() : null,
    },
  });
  await audit(req, submit ? 'MISSION_REPORT_SUBMITTED' : 'MISSION_REPORT_DRAFTED', 'Mission', mission.id);
  res.status(201).json({ report });
});

router.patch('/:id/reports/:reportId', validateBody(reportSchema.partial().extend({ reviewed: z.boolean().optional() })), async (req, res) => {
  const mission = await loadMission(req.params.id, req.user);
  const report = mission.reports.find((r) => r.id === req.params.reportId);
  if (!report) throw notFound('Rapport introuvable');
  const { submit, reviewed, ...data } = req.body;

  if (reviewed) {
    if (!canManage(mission, req.user)) throw forbidden();
    if (report.status !== 'SUBMITTED') throw badRequest('Seul un rapport soumis peut être marqué comme examiné');
    const updated = await prisma.missionReport.update({ where: { id: report.id }, data: { status: 'REVIEWED' } });
    await audit(req, 'MISSION_REPORT_REVIEWED', 'Mission', mission.id);
    return res.json({ report: updated });
  }

  if (report.authorId !== req.user.id) throw forbidden();
  if (report.status !== 'DRAFT') throw badRequest('Un rapport soumis ne peut plus être modifié');
  const updated = await prisma.missionReport.update({
    where: { id: report.id },
    data: { ...data, ...(submit && { status: 'SUBMITTED', submittedAt: new Date() }) },
  });
  if (submit) await audit(req, 'MISSION_REPORT_SUBMITTED', 'Mission', mission.id);
  res.json({ report: updated });
});

export default router;

// ----- Questionnaires (§26) -----------------------------------------------

export const questionnairesRouter = Router();

const questionnaireSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText(),
  categoryId: optionalId,
  questions: z.array(z.string().trim().min(1).max(2000)).min(1).max(300),
  isActive: z.boolean().optional(),
});

const serializeQuestionnaire = (q) => ({ ...q, questions: parseJson(q.questions, []) });

questionnairesRouter.get('/', async (req, res) => {
  const questionnaires = await prisma.questionnaire.findMany({
    orderBy: { title: 'asc' },
    include: { category: { select: { id: true, name: true } } },
  });
  res.json({ questionnaires: questionnaires.map(serializeQuestionnaire) });
});

questionnairesRouter.post('/', need(P.MISSIONS_MANAGE), validateBody(questionnaireSchema), async (req, res) => {
  const { questions, ...data } = req.body;
  const questionnaire = await prisma.questionnaire.create({
    data: { ...data, slug: await uniqueSlug(prisma.questionnaire, data.title), questions: JSON.stringify(questions) },
  });
  await audit(req, 'QUESTIONNAIRE_CREATED', 'Questionnaire', questionnaire.id);
  res.status(201).json({ questionnaire: serializeQuestionnaire(questionnaire) });
});

questionnairesRouter.patch('/:id', need(P.MISSIONS_MANAGE), validateBody(questionnaireSchema.partial()), async (req, res) => {
  const { questions, ...data } = req.body;
  const questionnaire = await prisma.questionnaire.update({
    where: { id: req.params.id },
    data: { ...data, ...(questions && { questions: JSON.stringify(questions) }) },
  });
  await audit(req, 'QUESTIONNAIRE_UPDATED', 'Questionnaire', questionnaire.id);
  res.json({ questionnaire: serializeQuestionnaire(questionnaire) });
});
