import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { publishDueItems } from '../src/services/workflow.js';
import { app, loginAs, prisma, request, resetDatabase, setupTeam, validateItem, withOrigin } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function team() {
  const data = await setupTeam();
  return {
    ...data,
    agents: {
      admin: await loginAs('admin@urithi.cd'),
      collecteur: await loginAs('collecteur@urithi.cd'),
      editeur: await loginAs('editeur@urithi.cd'),
      validateur: await loginAs('validateur@urithi.cd'),
    },
  };
}

function itemPayload({ category, community, source }, overrides = {}) {
  return {
    title: 'Préparation du plat',
    summary: 'Résumé documenté.',
    body: 'Description détaillée.',
    categoryId: category.id,
    communityIds: [community.id],
    sources: [{ sourceId: source.id, supports: 'Étapes de préparation' }],
    fields: { ingredients: ['manioc', 'haricots'] },
    verificationStatus: 'SOURCED',
    accessLevel: 'PUBLIC',
    ...overrides,
  };
}

async function createItem(agent, ctx, overrides) {
  const res = await withOrigin(agent.post('/api/admin/items')).send(itemPayload(ctx, overrides));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.item;
}

describe('circuit de validation et publication', () => {
  test('parcours complet jusqu’à la publication, visible du public sans compte', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    assert.equal(item.status, 'DRAFT');

    // Une fiche non publiée est invisible du public.
    assert.equal((await request(app).get(`/api/public/items/${item.slug}`)).status, 404);

    await validateItem(item.id, ctx.agents);
    const published = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const pub = await request(app).get(`/api/public/items/${item.slug}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.item.title, 'Préparation du plat');
    assert.deepEqual(pub.body.item.fields[0].value, ['manioc', 'haricots']);
    assert.equal(pub.body.item.sources[0].supports, 'Étapes de préparation');
    assert.equal(pub.body.item.history.length, 1);

    const decisions = await prisma.validationDecision.findMany({ where: { itemId: item.id } });
    assert.equal(decisions.length, 6);
    assert.ok(decisions.some((d) => d.type === 'APPROVE' && d.fromStatus === 'IN_CULTURAL_REVIEW'));
  });

  test('chaque étape exige la bonne permission', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await withOrigin(ctx.agents.collecteur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'SUBMITTED' });

    // Le collecteur ne peut pas faire avancer la vérification documentaire.
    const res = await withOrigin(ctx.agents.collecteur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'IN_DOCUMENT_REVIEW' });
    assert.equal(res.status, 403);
    // Une transition non prévue est refusée.
    const skip = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal(skip.status, 400);
  });

  test('la publication est refusée si les conditions ne sont pas réunies', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx, { summary: '', sources: [], verificationStatus: 'SOURCED' });
    await validateItem(item.id, ctx.agents);
    const res = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal(res.status, 422);
    const messages = res.body.details.map((d) => d.message).join(' | ');
    assert.match(messages, /résumé/);
    assert.match(messages, /source/);
  });

  test('une demande de complément, motif facultatif, revient à l’auteur', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await withOrigin(ctx.agents.collecteur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'SUBMITTED' });
    const ok = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`))
      .send({ toStatus: 'NEEDS_COMPLETION', requestedChanges: 'Ajouter le lieu de collecte' });
    assert.equal(ok.status, 200);
    // L'auteur peut de nouveau modifier sa fiche et la resoumettre.
    const edit = await withOrigin(ctx.agents.collecteur.patch(`/api/admin/items/${item.id}`)).send({ body: 'Complété', reason: 'Lieu ajouté' });
    assert.equal(edit.status, 200);
    const decision = await prisma.validationDecision.findFirst({ where: { itemId: item.id, type: 'REQUEST_CHANGES' } });
    assert.equal(decision.requestedChanges, 'Ajouter le lieu de collecte');
  });

  test('l’auteur ne peut plus modifier sa fiche une fois soumise', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await withOrigin(ctx.agents.collecteur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'SUBMITTED' });
    const res = await withOrigin(ctx.agents.collecteur.patch(`/api/admin/items/${item.id}`)).send({ title: 'Autre' });
    assert.equal(res.status, 403);
  });

  test('fiche sensible : l’auteur ne peut ni valider ni publier lui-même', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.editeur, ctx, { isSensitive: true });
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'SUBMITTED' });
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'IN_DOCUMENT_REVIEW' });
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'IN_CULTURAL_REVIEW' });
    await withOrigin(ctx.agents.validateur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'IN_EDITORIAL_REVIEW' });
    const self = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'VALIDATED' });
    assert.equal(self.status, 403);
    const other = await withOrigin(ctx.agents.admin.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'VALIDATED' });
    assert.equal(other.status, 200);
  });

  test('publication programmée exécutée par le planificateur', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await validateItem(item.id, ctx.agents);
    const past = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`))
      .send({ toStatus: 'SCHEDULED', scheduledAt: new Date(Date.now() - 1000).toISOString() });
    assert.equal(past.status, 400);
    const future = new Date(Date.now() + 60_000);
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'SCHEDULED', scheduledAt: future.toISOString() });
    assert.equal((await publishDueItems(new Date())).length, 0);
    const results = await publishDueItems(new Date(future.getTime() + 1000));
    assert.deepEqual(results, [{ id: item.id, published: true }]);
    assert.equal((await request(app).get(`/api/public/items/${item.slug}`)).status, 200);
  });
});

describe('files de travail', () => {
  test('filtre sur plusieurs statuts et compteurs par statut', async () => {
    const ctx = await team();
    const draft = await createItem(ctx.agents.collecteur, ctx, { title: 'Brouillon' });
    const submitted = await createItem(ctx.agents.collecteur, ctx, { title: 'Soumise' });
    await withOrigin(ctx.agents.collecteur.post(`/api/admin/items/${submitted.id}/transitions`)).send({ toStatus: 'SUBMITTED' });

    const both = await ctx.agents.editeur.get('/api/admin/items?status=DRAFT,SUBMITTED');
    assert.equal(both.status, 200);
    assert.deepEqual(both.body.items.map((i) => i.id).sort(), [draft.id, submitted.id].sort());
    const one = await ctx.agents.editeur.get('/api/admin/items?status=SUBMITTED');
    assert.deepEqual(one.body.items.map((i) => i.id), [submitted.id]);
    assert.equal((await ctx.agents.editeur.get('/api/admin/items?status=DRAFT,INCONNU')).status, 400);

    const dash = await ctx.agents.collecteur.get('/api/admin/dashboard');
    assert.equal(dash.body.myByStatus.DRAFT, 1);
    assert.equal(dash.body.myByStatus.SUBMITTED, 1);
    assert.equal(dash.body.byStatus.SUBMITTED, 1);
    const light = await ctx.agents.admin.get('/api/admin/dashboard?scope=counts');
    assert.equal(light.body.byStatus.DRAFT, 1);
    assert.equal(light.body.takedownsOpen, 0);
    assert.equal(light.body.stats, undefined);
  });
});

describe('versions et historique', () => {
  test('la modification d’une fiche publiée reste interne jusqu’à sa nouvelle validation', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await validateItem(item.id, ctx.agents);
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });

    const edit = await withOrigin(ctx.agents.editeur.patch(`/api/admin/items/${item.id}`))
      .send({ title: 'Titre corrigé', reason: 'Correction du titre', publicNote: 'Titre précisé' });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.item.status, 'UNDER_REVISION');

    const stillOld = await request(app).get(`/api/public/items/${item.slug}`);
    assert.equal(stillOld.body.item.title, 'Préparation du plat');

    for (const [agent, toStatus] of [
      [ctx.agents.editeur, 'IN_EDITORIAL_REVIEW'],
      [ctx.agents.editeur, 'VALIDATED'],
      [ctx.agents.editeur, 'PUBLISHED'],
    ]) {
      const r = await withOrigin(agent.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    const updated = await request(app).get(`/api/public/items/${item.slug}`);
    assert.equal(updated.body.item.title, 'Titre corrigé');
    assert.equal(updated.body.item.history.length, 2);
    assert.equal(updated.body.item.history[0].publicNote, 'Titre précisé');
  });

  test('restaurer une version crée une nouvelle version sans effacer l’historique', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await withOrigin(ctx.agents.collecteur.patch(`/api/admin/items/${item.id}`)).send({ title: 'Deuxième titre', reason: 'Essai' });
    const restored = await withOrigin(ctx.agents.collecteur.post(`/api/admin/items/${item.id}/versions/1/restore`));
    assert.equal(restored.status, 200);
    assert.equal(restored.body.item.title, 'Préparation du plat');
    assert.equal(restored.body.item.currentVersion, 3);
    const versions = await prisma.itemVersion.findMany({ where: { itemId: item.id }, orderBy: { version: 'asc' } });
    assert.deepEqual(versions.map((v) => v.reason), ['Création de la fiche', 'Essai', 'Restauration de la version 1']);
  });

  test('les champs spécialisés doivent correspondre à la catégorie', async () => {
    const ctx = await team();
    const res = await withOrigin(ctx.agents.collecteur.post('/api/admin/items')).send(itemPayload(ctx, { fields: { inconnu: 'x' } }));
    assert.equal(res.status, 400);
  });
});

describe('niveaux d’accès', () => {
  test('une fiche privée est invisible des autres contributeurs', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx, { accessLevel: 'PRIVATE' });
    assert.equal((await ctx.agents.editeur.get(`/api/admin/items/${item.id}`)).status, 404);
    const list = await ctx.agents.editeur.get('/api/admin/items');
    assert.equal(list.body.items.length, 0);
    assert.equal((await ctx.agents.admin.get(`/api/admin/items/${item.id}`)).status, 200);
  });

  test('accès nominatif à une fiche d’équipe', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx, { accessLevel: 'TEAM' });
    assert.equal((await ctx.agents.validateur.get(`/api/admin/items/${item.id}`)).status, 404);
    const grant = await withOrigin(ctx.agents.admin.post(`/api/admin/items/${item.id}/grants`)).send({ userId: ctx.validateur.id });
    assert.equal(grant.status, 201);
    assert.equal((await ctx.agents.validateur.get(`/api/admin/items/${item.id}`)).status, 200);
  });

  test('une fiche publiée devenue restreinte disparaît du public', async () => {
    const ctx = await team();
    const item = await createItem(ctx.agents.collecteur, ctx);
    await validateItem(item.id, ctx.agents);
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    await withOrigin(ctx.agents.editeur.patch(`/api/admin/items/${item.id}`)).send({ accessLevel: 'CONTRIBUTORS' });
    assert.equal((await request(app).get(`/api/public/items/${item.slug}`)).status, 404);
    const search = await request(app).get('/api/public/search?q=plat');
    assert.equal(search.body.items.length, 0);
  });
});
