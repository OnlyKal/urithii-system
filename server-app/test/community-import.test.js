import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { loginAs, prisma, resetDatabase, setupTeam, withOrigin } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function team() {
  const data = await setupTeam();
  const rdc = await prisma.place.create({ data: { name: 'RDC', type: 'COUNTRY' } });
  const sudKivu = await prisma.place.create({ data: { name: 'Sud-Kivu', type: 'PROVINCE', parentId: rdc.id } });
  await prisma.place.create({ data: { name: 'Idjwi', type: 'TERRITORY', parentId: sudKivu.id } });
  await prisma.language.create({ data: { name: 'Kihavu', isoCode: 'hav' } });
  return { ...data, admin: await loginAs('admin@urithi.cd'), collecteur: await loginAs('collecteur@urithi.cd') };
}

const send = (agent, body) => withOrigin(agent.post('/api/admin/communities/import')).send(body);

const file = {
  communities: [
    {
      name: 'Communauté importée',
      otherNames: ['Autre nom', { name: 'Nom historique', kind: 'HISTORICAL' }],
      summary: 'Résumé importé.',
      documentationStatus: 'PARTIAL',
      places: ['Idjwi', { name: 'Lieu inconnu' }],
      languages: [{ isoCode: 'hav' }],
    },
    { name: 'BAHAVU', otherNames: ['Havu'] },
    { name: '' },
  ],
};

describe('import de communautés', () => {
  test('analyse sans écriture, puis import sans doublon ni publication', async () => {
    const ctx = await team();
    assert.equal((await send(ctx.collecteur, { data: file })).status, 403);

    const dry = await send(ctx.admin, { data: file });
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.deepEqual(dry.body.counts, { create: 1, update: 0, skip: 1, error: 1 });
    assert.ok(dry.body.results[0].messages.some((m) => m.includes('Lieu inconnu')));
    assert.equal(await prisma.community.count({ where: { name: 'Communauté importée' } }), 0);

    const done = await send(ctx.admin, { data: file, dryRun: false });
    assert.equal(done.status, 200);
    assert.equal(done.body.counts.create, 1);
    const created = await prisma.community.findFirst({ where: { name: 'Communauté importée' }, include: { names: true, places: true, languages: true } });
    assert.equal(created.isPublished, false);
    assert.equal(created.documentationStatus, 'PARTIAL');
    assert.deepEqual(created.names.map((n) => n.kind).sort(), ['HISTORICAL', 'PRIMARY', 'VARIANT']);
    assert.equal(created.places.length, 1);
    assert.equal(created.languages.length, 1);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'COMMUNITIES_IMPORTED' } }));

    // Relancer le même import ne crée rien.
    const again = await send(ctx.admin, { data: file, dryRun: false });
    assert.equal(again.body.counts.create, 0);
    assert.equal(again.body.counts.skip, 2);
  });

  test('mode « compléter » : champs vides remplis, rien d’effacé', async () => {
    const ctx = await team();
    await prisma.community.update({ where: { id: ctx.community.id }, data: { summary: 'Résumé existant' } });
    const res = await send(ctx.admin, {
      data: [{ name: 'Havu', otherNames: ['Bahavu'], summary: 'Autre résumé', description: 'Description ajoutée', places: ['Idjwi'] }],
      mode: 'update',
      dryRun: false,
    });
    assert.equal(res.body.counts.update, 1);
    const havu = await prisma.community.findUnique({ where: { id: ctx.community.id }, include: { names: true, places: true } });
    assert.equal(havu.summary, 'Résumé existant');
    assert.equal(havu.description, 'Description ajoutée');
    assert.ok(havu.names.some((n) => n.name === 'Bahavu'));
    assert.equal(havu.places.length, 1);
  });

  test('fichier invalide et doublon interne', async () => {
    const ctx = await team();
    assert.equal((await send(ctx.admin, { data: { autre: [] } })).status, 400);
    const dup = await send(ctx.admin, { data: [{ name: 'A' }, { name: 'a' }] });
    assert.deepEqual(dup.body.counts, { create: 1, update: 0, skip: 0, error: 1 });
  });
});
