import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { loadRolePermissions } from '../src/auth/permissions.js';
import { hashPassword } from '../src/lib/password.js';

// Les tests vident la base et le stockage : ils ne tournent que sur la base
// de test (npm test), jamais sur la base réelle par défaut.
if (process.env.NODE_ENV !== 'test' || !/test\.db$/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Tests refusés : lancez-les avec « npm test » (base data/test.db), jamais sur la base réelle.');
}

export const app = createApp();
export const ORIGIN = 'http://localhost:5180';

// Vide toutes les tables, dans un ordre compatible avec les clés étrangères.
export async function resetDatabase() {
  await prisma.gameMission.deleteMany();
  await prisma.gameStat.deleteMany();
  await prisma.dossierEvent.deleteMany();
  await prisma.dossierVersion.deleteMany();
  await prisma.collectionDossier.deleteMany();
  await prisma.dossierSectionDef.deleteMany();
  const order = [
    'textRevision', 'itemRelation', 'accessGrant', 'validationDecision', 'itemCommunity', 'itemPlace',
    'itemSource', 'itemMedia', 'itemConsent', 'takedownRequest', 'missionQuestionnaire', 'fieldNote',
    'missionReport', 'missionMember', 'missionResourcePerson',
  ];
  for (const model of order) await prisma[model].deleteMany();
  await prisma.textDocument.deleteMany({ where: { translationOfId: { not: null } } });
  await prisma.textDocument.deleteMany();
  await prisma.culturalItem.updateMany({ data: { publishedVersionId: null } });
  await prisma.itemVersion.deleteMany();
  await prisma.culturalItem.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.resourcePerson.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.questionnaire.deleteMany();
  await prisma.communityName.deleteMany();
  await prisma.communityPlace.deleteMany();
  await prisma.communityLanguage.deleteMany();
  await prisma.community.deleteMany();
  await prisma.source.deleteMany();
  await prisma.category.updateMany({ data: { parentId: null } });
  await prisma.category.deleteMany();
  await prisma.place.updateMany({ data: { parentId: null } });
  await prisma.place.deleteMany();
  await prisma.language.deleteMany();
  await prisma.storedFile.updateMany({ data: { derivedFromId: null } });
  await prisma.storedFile.deleteMany();
  await prisma.backupRun.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await loadRolePermissions(prisma);
}

// Jeu de données minimal : une équipe complète et les référentiels.
export async function setupTeam() {
  const admin = await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
  const collecteur = await createUser({ email: 'collecteur@urithi.cd', roles: ['COLLECTEUR'] });
  const editeur = await createUser({ email: 'editeur@urithi.cd', roles: ['EDITEUR'] });
  const validateur = await createUser({ email: 'validateur@urithi.cd', roles: ['VALIDATEUR'] });
  const category = await prisma.category.create({
    data: {
      slug: 'gastronomie',
      name: 'Gastronomie',
      code: 'D',
      fieldsSchema: JSON.stringify([{ key: 'ingredients', label: 'Ingrédients', type: 'list' }]),
    },
  });
  const community = await prisma.community.create({
    data: { slug: 'havu', name: 'Havu', isPublished: true, searchText: 'havu' },
  });
  const source = await prisma.source.create({ data: { type: 'FIELDWORK', title: 'Entretien de terrain, 2026' } });
  return { admin, collecteur, editeur, validateur, category, community, source };
}

export const withOrigin = (req) => req.set('Origin', ORIGIN);

// Fait passer une fiche par tout le circuit jusqu'à « Validé ».
export async function validateItem(itemId, { collecteur, editeur, validateur }) {
  const step = async (agent, toStatus, extra = {}) => {
    const res = await agent.post(`/api/admin/items/${itemId}/transitions`).set('Origin', ORIGIN).send({ toStatus, ...extra });
    if (res.status !== 200) throw new Error(`${toStatus} : ${res.status} ${JSON.stringify(res.body)}`);
    return res;
  };
  await step(collecteur, 'SUBMITTED');
  await step(editeur, 'IN_DOCUMENT_REVIEW');
  await step(editeur, 'IN_CULTURAL_REVIEW');
  await step(validateur, 'IN_EDITORIAL_REVIEW');
  await step(editeur, 'VALIDATED');
}

export async function createUser({ email, password = 'mot-de-passe-solide', roles, mustChangePassword = false, isActive = true }) {
  return prisma.user.create({
    data: {
      email,
      displayName: email.split('@')[0],
      passwordHash: await hashPassword(password),
      mustChangePassword,
      isActive,
      roles: { create: roles.map((role) => ({ role })) },
    },
    include: { roles: true },
  });
}

// Renvoie un agent supertest qui conserve le cookie de session.
export async function loginAs(email, password = 'mot-de-passe-solide') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
  if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} : ${res.status}`);
  return agent;
}

export { prisma, request };
