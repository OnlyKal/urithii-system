import assert from 'node:assert/strict';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, beforeEach, describe, test } from 'node:test';
import { config } from '../src/config.js';
import { recordAudit } from '../src/services/audit.js';
import { restoreTest, runBackup, verifyBackup } from '../src/services/backup.js';
import { storeOriginal } from '../src/services/storage.js';
import { app, createUser, loginAs, prisma, request, resetDatabase, setupTeam, validateItem, withOrigin } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function publishedItem(ctx, agents, title) {
  const item = await withOrigin(agents.collecteur.post('/api/admin/items')).send({
    title,
    summary: 'Résumé',
    categoryId: ctx.category.id,
    communityIds: [ctx.community.id],
    sources: [{ sourceId: ctx.source.id }],
    accessLevel: 'PUBLIC',
  });
  await validateItem(item.body.item.id, agents);
  await withOrigin(agents.editeur.post(`/api/admin/items/${item.body.item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
  return item.body.item;
}

async function agentsFor() {
  return {
    admin: await loginAs('admin@urithi.cd'),
    collecteur: await loginAs('collecteur@urithi.cd'),
    editeur: await loginAs('editeur@urithi.cd'),
    validateur: await loginAs('validateur@urithi.cd'),
  };
}

describe('site public', () => {
  test('recherche insensible aux accents et aux majuscules', async () => {
    const ctx = await setupTeam();
    const agents = await agentsFor();
    await publishedItem(ctx, agents, 'Cérémonie de dénomination');
    const res = await request(app).get('/api/public/search?q=CEREMONIE denomination');
    assert.equal(res.body.items.length, 1);
    const none = await request(app).get('/api/public/search?q=inexistant');
    assert.equal(none.body.items.length, 0);
    const filtered = await request(app).get('/api/public/items?category=gastronomie&community=havu');
    assert.equal(filtered.body.total, 1);
  });

  test('explorer une province inclut ses territoires', async () => {
    const ctx = await setupTeam();
    const agents = await agentsFor();
    const province = await prisma.place.create({ data: { name: 'Sud-Kivu', type: 'PROVINCE' } });
    const territory = await prisma.place.create({ data: { name: 'Idjwi', type: 'TERRITORY', parentId: province.id } });
    await prisma.communityPlace.create({ data: { communityId: ctx.community.id, placeId: territory.id } });
    await publishedItem(ctx, agents, 'Fiche de la communauté');
    const communities = await request(app).get(`/api/public/communities?placeId=${province.id}`);
    assert.deepEqual(communities.body.communities.map((c) => c.slug), ['havu']);
    const items = await request(app).get(`/api/public/items?placeId=${province.id}`);
    assert.equal(items.body.total, 1);
    const other = await prisma.place.create({ data: { name: 'Kinshasa', type: 'PROVINCE' } });
    assert.equal((await request(app).get(`/api/public/communities?placeId=${other.id}`)).body.communities.length, 0);
  });

  test('une communauté non publiée n’apparaît pas', async () => {
    await prisma.community.create({ data: { slug: 'cachee', name: 'Cachée', isPublished: false, searchText: 'cachee' } });
    assert.equal((await request(app).get('/api/public/communities/cachee')).status, 404);
    assert.equal((await request(app).get('/api/public/communities')).body.communities.length, 0);
  });

  test('l’accueil et les statistiques reposent sur les données réelles', async () => {
    const ctx = await setupTeam();
    const agents = await agentsFor();
    const home0 = await request(app).get('/api/public/home');
    assert.deepEqual(home0.body.stats, { communities: 1, items: 0, media: 0 });
    await publishedItem(ctx, agents, 'Première fiche');
    const home = await request(app).get('/api/public/home');
    assert.equal(home.body.stats.items, 1);
    assert.equal(home.body.recent[0].title, 'Première fiche');
  });

  test('signalement public puis suspension du contenu', async () => {
    const ctx = await setupTeam();
    const agents = await agentsFor();
    const item = await publishedItem(ctx, agents, 'Fiche signalée');
    const sent = await withOrigin(request(app).post('/api/public/takedown-requests')).send({
      itemSlug: item.slug,
      requesterName: 'Une personne concernée',
      requesterContact: 'contact@example.cd',
      reason: 'CONSENT',
      description: 'Je n’ai pas autorisé cette publication.',
    });
    assert.equal(sent.status, 201);
    assert.equal((await agents.collecteur.get('/api/admin/takedowns')).status, 403);
    const suspend = await withOrigin(agents.admin.post(`/api/admin/takedowns/${sent.body.id}/suspend`)).send({ reason: 'Risque sérieux' });
    assert.equal(suspend.status, 200);
    assert.equal((await request(app).get(`/api/public/items/${item.slug}`)).status, 404);
    // La fiche et ses versions sont conservées.
    assert.equal(await prisma.itemVersion.count({ where: { itemId: item.id } }), 1);
  });

  test('l’export public ne contient que les contenus publiés', async () => {
    const ctx = await setupTeam();
    const agents = await agentsFor();
    await publishedItem(ctx, agents, 'Publique');
    await withOrigin(agents.collecteur.post('/api/admin/items')).send({ title: 'Brouillon secret', categoryId: ctx.category.id });
    const res = await request(app).get('/api/public/export');
    assert.equal(res.body.items.length, 1);
    assert.doesNotMatch(JSON.stringify(res.body), /Brouillon secret/);
    assert.equal((await agents.editeur.get('/api/admin/preservation/export')).status, 403);
    const full = await agents.admin.get('/api/admin/preservation/export');
    assert.equal(full.status, 200);
    assert.doesNotMatch(JSON.stringify(full.body), /passwordHash|scrypt\$/);
  });
});

describe('permissions configurables', () => {
  test('retirer une permission à un rôle prend effet immédiatement', async () => {
    const ctx = await setupTeam();
    const admin = await loginAs('admin@urithi.cd');
    const collecteur = await loginAs('collecteur@urithi.cd');
    const res = await withOrigin(admin.put('/api/admin/settings/permissions/COLLECTEUR')).send({ permissions: ['missions.participate'] });
    assert.equal(res.status, 200);
    const create = await withOrigin(collecteur.post('/api/admin/items')).send({ title: 'X', categoryId: ctx.category.id });
    assert.equal(create.status, 403);
    const locked = await withOrigin(admin.put('/api/admin/settings/permissions/SUPER_ADMIN')).send({ permissions: [] });
    assert.equal(locked.status, 400);
    await withOrigin(admin.delete('/api/admin/settings/permissions/COLLECTEUR'));
    const again = await withOrigin(collecteur.post('/api/admin/items')).send({ title: 'X', categoryId: ctx.category.id });
    assert.equal(again.status, 201);
  });
});

describe('missions', () => {
  test('un collecteur ne voit que ses missions et peut y déposer un rapport', async () => {
    await setupTeam();
    const responsable = await createUser({ email: 'resp@urithi.cd', roles: ['RESPONSABLE_COLLECTE'] });
    const resp = await loginAs('resp@urithi.cd');
    const collecteur = await loginAs('collecteur@urithi.cd');
    const collecteurUser = await prisma.user.findUnique({ where: { email: 'collecteur@urithi.cd' } });

    const m1 = await withOrigin(resp.post('/api/admin/missions')).send({ title: 'Pilote Havu', objective: 'Tester le protocole' });
    assert.equal(m1.status, 201, JSON.stringify(m1.body));
    assert.equal(m1.body.mission.responsible.id, responsable.id);
    await withOrigin(resp.post('/api/admin/missions')).send({ title: 'Autre mission', objective: 'Autre' });

    assert.equal((await collecteur.get('/api/admin/missions')).body.missions.length, 0);
    await withOrigin(resp.post(`/api/admin/missions/${m1.body.mission.id}/members`)).send({ userId: collecteurUser.id });
    const mine = await collecteur.get('/api/admin/missions');
    assert.deepEqual(mine.body.missions.map((m) => m.title), ['Pilote Havu']);

    const report = await withOrigin(collecteur.post(`/api/admin/missions/${m1.body.mission.id}/reports`)).send({ summary: 'Trois entretiens', submit: true });
    assert.equal(report.status, 201);
    assert.equal(report.body.report.status, 'SUBMITTED');
    const edit = await withOrigin(collecteur.patch(`/api/admin/missions/${m1.body.mission.id}/reports/${report.body.report.id}`)).send({ summary: 'modifié' });
    assert.equal(edit.status, 400);
    const forbidden = await withOrigin(collecteur.patch(`/api/admin/missions/${m1.body.mission.id}`)).send({ status: 'COMPLETED' });
    assert.equal(forbidden.status, 403);
  });
});

describe('sauvegarde et restauration', () => {
  test('sauvegarde complète, vérification, test de restauration et détection d’altération', async () => {
    // Les tests précédents laissent des fichiers sur disque : on repart d'un stockage vide.
    await rm(path.resolve(config.storageDir, 'originals'), { recursive: true, force: true });
    const user = await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    await storeOriginal({ buffer: Buffer.from('original audio'), originalName: 'a.wav', mimeType: 'audio/wav', uploadedById: user.id });

    await recordAudit({ actorId: user.id, action: 'TEST_BEFORE_BACKUP' });
    const backup = await runBackup({ triggeredById: user.id });
    assert.equal(backup.files, 1);
    assert.equal((await verifyBackup(backup.location)).valid, true);

    const test1 = await restoreTest({ dir: backup.location, triggeredById: user.id });
    assert.equal(test1.success, true, JSON.stringify(test1.problems));
    assert.equal(test1.counts.storedFiles, 1);

    const manifest = JSON.parse(await readFile(path.join(backup.location, 'manifest.json'), 'utf8'));
    const lastAudit = await prisma.auditLog.findFirst({ orderBy: { id: 'desc' } });
    assert.equal(manifest.auditHead.hash, (await prisma.auditLog.findFirst({ where: { action: 'TEST_BEFORE_BACKUP' } })).hash);
    assert.ok(manifest.auditHead.id <= lastAudit.id);
    // Les copies sont en lecture seule : on lève la protection pour simuler une altération.
    const target = path.join(backup.location, manifest.files[0].path);
    await chmod(target, 0o640);
    await writeFile(target, 'altéré');
    const check = await verifyBackup(backup.location);
    assert.equal(check.valid, false);
    assert.match(check.problems[0], /altéré/);

    const runs = await prisma.backupRun.findMany();
    assert.ok(runs.some((r) => r.kind === 'BACKUP' && r.status === 'SUCCESS'));
    assert.ok(runs.some((r) => r.kind === 'RESTORE_TEST' && r.status === 'SUCCESS'));
  });
});

describe('réseau du patrimoine', () => {
  test('ne relie les communautés publiées que par des données publiques documentées', async () => {
    const ctx = await setupTeam();
    const agents = await agentsFor();
    const shi = await prisma.community.create({ data: { slug: 'shi', name: 'Shi', isPublished: true, searchText: 'shi' } });
    const hidden = await prisma.community.create({ data: { slug: 'cachee', name: 'Cachée', searchText: 'cachee' } });
    const province = await prisma.place.create({ data: { name: 'Sud-Kivu', type: 'PROVINCE' } });
    const territory = await prisma.place.create({ data: { name: 'Kalehe', type: 'TERRITORY', parentId: province.id } });
    const language = await prisma.language.create({ data: { name: 'Swahili' } });
    await prisma.communityPlace.createMany({
      data: [
        { communityId: ctx.community.id, placeId: territory.id },
        { communityId: shi.id, placeId: province.id },
        { communityId: hidden.id, placeId: province.id },
      ],
    });
    await prisma.communityLanguage.createMany({
      data: [
        { communityId: ctx.community.id, languageId: language.id },
        { communityId: shi.id, languageId: language.id },
      ],
    });

    const create = (title, communityIds, accessLevel = 'PUBLIC') =>
      withOrigin(agents.collecteur.post('/api/admin/items'))
        .send({ title, summary: 'Résumé', categoryId: ctx.category.id, communityIds, sources: [{ sourceId: ctx.source.id }], accessLevel })
        .then((r) => r.body.item);
    const publish = async (item) => {
      await validateItem(item.id, agents);
      await withOrigin(agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    };
    const havuDish = await create('Plat havu', [ctx.community.id]);
    const shiDish = await create('Plat shi', [shi.id]);
    const shared = await create('Plat commun', [ctx.community.id, shi.id, hidden.id]);
    const draft = await create('Brouillon shi', [shi.id]);
    for (const item of [havuDish, shiDish, shared]) await publish(item);
    const relate = (toId, type, notes) => withOrigin(agents.editeur.post(`/api/admin/items/${havuDish.id}/relations`)).send({ toId, type, notes });
    assert.equal((await relate(shiDish.id, 'VARIANT_OF', 'Même préparation')).status, 201);
    // Une relation vers une fiche non publiée ne crée aucun lien public.
    assert.equal((await relate(draft.id, 'RELATED')).status, 201);

    const res = await request(app).get('/api/public/network');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.communities.map((c) => c.slug), ['havu', 'shi']);
    assert.deepEqual(res.body.totals, { published: 2, recorded: 3 });
    const havu = res.body.communities.find((c) => c.slug === 'havu');
    assert.equal(havu.itemCount, 2);
    assert.deepEqual(havu.provinces, ['Sud-Kivu']);
    assert.deepEqual(havu.domains, [{ slug: 'gastronomie', count: 2 }]);

    assert.equal(res.body.links.length, 1);
    const [link] = res.body.links;
    assert.deepEqual([link.source, link.target], ['havu', 'shi']);
    assert.deepEqual(link.languages, ['Swahili']);
    assert.deepEqual(link.provinces, ['Sud-Kivu']);
    assert.deepEqual(link.sharedItems.map((i) => i.title), ['Plat commun']);
    assert.equal(link.relations.length, 1);
    assert.equal(link.relations[0].type, 'VARIANT_OF');
    assert.equal(link.relations[0].notes, 'Même préparation');
    assert.equal(link.relations[0].source.title, 'Plat havu');
    assert.equal(link.relations[0].target.title, 'Plat shi');
    assert.ok(!JSON.stringify(res.body).includes('Brouillon') && !JSON.stringify(res.body).includes('cachee'));
  });
});
