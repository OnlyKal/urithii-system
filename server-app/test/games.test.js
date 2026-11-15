import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { DEFAULT_GAME_MISSIONS, ensureGameMissions } from '../src/data/gameMissions.js';
import { app, loginAs, prisma, request, resetDatabase, setupTeam, withOrigin } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

const newMission = {
  slug: 'mission-test',
  title: 'Mission de test',
  description: 'Une mission créée par l’administration.',
  objective: 'Observer l’okapi.',
  mode: 'nature',
  environment: 'ituri',
  rewardXp: 50,
  status: 'DRAFT',
  steps: [{ id: 'okapi', type: 'discover', label: 'Observer l’okapi', targets: ['okapi'], count: 1 }],
};

describe('module Jeux', () => {
  test('les missions fournies sont créées une seule fois, publiées sauf les brouillons', async () => {
    await ensureGameMissions(prisma);
    await ensureGameMissions(prisma);
    assert.equal(await prisma.gameMission.count(), DEFAULT_GAME_MISSIONS.length);
    const res = await request(app).get('/api/public/games/missions');
    assert.equal(res.status, 200);
    const published = DEFAULT_GAME_MISSIONS.filter((m) => (m.status ?? 'PUBLISHED') === 'PUBLISHED');
    assert.equal(res.body.missions.length, published.length);
    assert.ok(!res.body.missions.some((m) => m.slug === 'voix-des-communautes'));
    const forest = res.body.missions.find((m) => m.slug === 'secrets-de-la-foret');
    assert.ok(forest.steps.find((s) => s.type === 'quiz').questions.every((q) => q.source));
    assert.equal(forest.builtin, undefined);
  });

  test('gestion des missions réservée à la permission games.manage', async () => {
    await setupTeam();
    const collecteur = await loginAs('collecteur@urithi.cd');
    assert.equal((await collecteur.get('/api/admin/games/missions')).status, 403);

    const admin = await loginAs('admin@urithi.cd');
    const created = await withOrigin(admin.post('/api/admin/games/missions')).send(newMission);
    assert.equal(created.status, 201, JSON.stringify(created.body));

    // Brouillon : invisible du public.
    let pub = await request(app).get('/api/public/games/missions');
    assert.equal(pub.body.missions.length, 0);

    const published = await withOrigin(admin.patch(`/api/admin/games/missions/${created.body.mission.id}`)).send({ status: 'PUBLISHED' });
    assert.equal(published.status, 200);
    pub = await request(app).get('/api/public/games/missions');
    assert.deepEqual(pub.body.missions.map((m) => m.slug), ['mission-test']);

    assert.equal((await withOrigin(admin.delete(`/api/admin/games/missions/${created.body.mission.id}`))).status, 204);
  });

  test('validation des étapes et protection des missions fournies', async () => {
    await setupTeam();
    await ensureGameMissions(prisma);
    const admin = await loginAs('admin@urithi.cd');
    const badQuiz = { ...newMission, steps: [{ id: 'q', type: 'quiz', label: 'Quiz', targets: ['ecogarde'], count: 1, questions: [{ q: 'Question ?', choices: ['a', 'b'], answer: 3, source: 'okapi' }] }] };
    assert.equal((await withOrigin(admin.post('/api/admin/games/missions')).send(badQuiz)).status, 400);
    const tooMany = { ...newMission, steps: [{ ...newMission.steps[0], count: 4 }] };
    assert.equal((await withOrigin(admin.post('/api/admin/games/missions')).send(tooMany)).status, 400);

    // Cibles qui suivent la plateforme : un groupe peut compter plusieurs fois.
    const dynamic = {
      ...newMission,
      slug: 'mission-plateforme',
      steps: [
        { id: 'faune', type: 'discover', label: 'Observer trois animaux de l’atlas', targets: ['atlas-faune'], count: 3 },
        { id: 'fiches', type: 'read', label: 'Lire cinq fiches', targets: ['toutes'], count: 5 },
        { id: 'theme', type: 'read', label: 'Lire deux fiches de gastronomie', targets: ['categorie-gastronomie-et-alimentation'], count: 2 },
        { id: 'communautes', type: 'community', label: 'Rencontrer deux communautés', targets: ['toutes'], count: 2 },
      ],
    };
    const dynamicRes = await withOrigin(admin.post('/api/admin/games/missions')).send(dynamic);
    assert.equal(dynamicRes.status, 201, JSON.stringify(dynamicRes.body));
    const badType = { ...newMission, slug: 'mauvais-type', steps: [{ ...newMission.steps[0], type: 'inconnu' }] };
    assert.equal((await withOrigin(admin.post('/api/admin/games/missions')).send(badType)).status, 400);

    const builtin = await prisma.gameMission.findUnique({ where: { slug: 'premiers-pas' } });
    assert.equal((await withOrigin(admin.delete(`/api/admin/games/missions/${builtin.id}`))).status, 400);
    assert.equal((await withOrigin(admin.patch(`/api/admin/games/missions/${builtin.id}`)).send({ slug: 'autre' })).status, 400);
    const disabled = await withOrigin(admin.patch(`/api/admin/games/missions/${builtin.id}`)).send({ status: 'DISABLED' });
    assert.equal(disabled.status, 200);
    // Un changement de statut seul conserve les fiches associées et la position.
    assert.equal(disabled.body.mission.status, 'DISABLED');
    assert.deepEqual(disabled.body.mission.contentRefs, ['foret-ituri']);
    assert.equal(disabled.body.mission.position, 1);
  });

  test('statistiques anonymes agrégées par jour', async () => {
    await setupTeam();
    for (let i = 0; i < 3; i++) {
      assert.equal((await withOrigin(request(app).post('/api/public/games/events')).send({ event: 'mission_complete', mission: 'premiers-pas' })).status, 204);
    }
    await withOrigin(request(app).post('/api/public/games/events')).send({ event: 'session' });
    assert.equal((await withOrigin(request(app).post('/api/public/games/events')).send({ event: 'inconnu' })).status, 400);
    const admin = await loginAs('admin@urithi.cd');
    const stats = await admin.get('/api/admin/games/stats');
    assert.equal(stats.status, 200);
    assert.equal(stats.body.totals.find((t) => t.event === 'mission_complete').count, 3);
    assert.equal(stats.body.totals.find((t) => t.event === 'session').count, 1);
  });
});
