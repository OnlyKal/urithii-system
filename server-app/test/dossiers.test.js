import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { app, createUser, loginAs, prisma, request, resetDatabase, setupTeam, withOrigin } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function team() {
  const data = await setupTeam();
  await createUser({ email: 'autre@urithi.cd', roles: ['COLLECTEUR'] });
  await prisma.category.create({ data: { slug: 'identite', name: 'Identité et présentation', code: 'A' } });
  return {
    ...data,
    admin: await loginAs('admin@urithi.cd'),
    collecteur: await loginAs('collecteur@urithi.cd'),
    autre: await loginAs('autre@urithi.cd'),
  };
}

const post = (agent, url, body) => withOrigin(agent.post(url)).send(body);
const patch = (agent, url, body) => withOrigin(agent.patch(url)).send(body);
const put = (agent, url, body) => withOrigin(agent.put(url)).send(body);

// Données d'un dossier : une présentation, deux plats (dont un sensible) et un
// témoignage avec consentement rattaché à la gastronomie.
function sampleData({ source, consentId, personId }) {
  return {
    sections: {
      identification: { values: { presentation: 'Présentation documentée de la communauté.' }, fieldStatus: { origineNom: 'UNKNOWN' } },
      gastronomie: {
        values: { habitudes: 'Habitudes alimentaires documentées.' },
        sources: [{ sourceId: source.id, supports: 'Habitudes' }],
        entries: [
          { id: 'e1', values: { nom: 'Plat documenté', ingredients: ['manioc', 'haricots'], cookingTechniques: 'Cuisson lente.' }, sources: [{ sourceId: source.id }] },
          { id: 'e2', values: { nom: 'Plat réservé', occasions: 'Cérémonie' }, sensitive: true },
          { id: 'e3', values: { nom: 'Plat sans source', occasions: 'Fêtes' } },
        ],
      },
      temoignages: {
        entries: consentId ? [{ id: 't1', values: { theme: 'Cuisine', temoin: personId, consentement: consentId, sections: ['identification'] } }] : [],
      },
    },
  };
}

async function createDossier(ctx, agent = ctx.collecteur) {
  const res = await post(agent, '/api/admin/dossiers', { communityId: ctx.community.id, title: 'Collecte test' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.dossier;
}

describe('dossiers de collecte', () => {
  test('les étapes de référence sont créées et lisibles par le collecteur', async () => {
    const ctx = await team();
    const res = await ctx.collecteur.get('/api/admin/dossier-sections');
    assert.equal(res.status, 200);
    assert.equal(res.body.sections.length, 21);
    assert.equal(res.body.sections.find((s) => s.key === 'gastronomie').entry.titleField, 'nom');
    assert.equal(res.body.sections.find((s) => s.key === 'gastronomie').categoryId, ctx.category.id);
  });

  test('un collecteur ne voit que ses dossiers ; enregistrement et avancement', async () => {
    const ctx = await team();
    const dossier = await createDossier(ctx);
    assert.equal(dossier.status, 'DRAFT');
    const saved = await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data: sampleData(ctx) });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.dossier.status, 'IN_PROGRESS');
    assert.ok(saved.body.dossier.progress > 0);

    assert.equal((await ctx.autre.get(`/api/admin/dossiers/${dossier.id}`)).status, 404);
    assert.equal((await ctx.autre.get('/api/admin/dossiers')).body.total, 0);
    assert.equal((await ctx.admin.get('/api/admin/dossiers')).body.total, 1);
    // Un compte sans rôle de collecte n'y a pas accès.
    assert.equal((await (await loginAs('validateur@urithi.cd')).get('/api/admin/dossiers')).status, 403);
  });

  test('contenu refusé : étape inconnue, média inexistant', async () => {
    const ctx = await team();
    const dossier = await createDossier(ctx);
    const unknown = await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data: { sections: { inventee: { values: {} } } } });
    assert.equal(unknown.status, 400);
    const media = await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, {
      data: { sections: { gastronomie: { media: [{ mediaId: '00000000-0000-4000-8000-000000000000' }] } } },
    });
    assert.equal(media.status, 400);
  });

  test('communauté proposée : doublon refusé, création par l’administrateur', async () => {
    const ctx = await team();
    const dup = await post(ctx.collecteur, '/api/admin/dossiers', { proposedCommunityName: 'HAVU' });
    assert.equal(dup.status, 409);
    const created = await post(ctx.collecteur, '/api/admin/dossiers', { proposedCommunityName: 'Communauté nouvelle' });
    assert.equal(created.status, 201);
    assert.equal((await post(ctx.collecteur, `/api/admin/dossiers/${created.body.dossier.id}/community`, {})).status, 403);
    const resolved = await post(ctx.admin, `/api/admin/dossiers/${created.body.dossier.id}/community`, {});
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    const community = await prisma.community.findUnique({ where: { id: resolved.body.dossier.communityId } });
    assert.equal(community.name, 'Communauté nouvelle');
    assert.equal(community.isPublished, false);
  });

  test('circuit complet : soumission, corrections ciblées, validation, publication', async () => {
    const ctx = await team();
    const collectorId = (await prisma.user.findUnique({ where: { email: 'collecteur@urithi.cd' } })).id;
    const person = await prisma.resourcePerson.create({ data: { fullName: 'Témoin', attributionMode: 'ANONYMOUS', createdById: collectorId } });
    const consent = await prisma.consent.create({
      data: {
        resourcePersonId: person.id,
        collectedAt: new Date(),
        canPublish: true,
        canStore: true,
        allowsInterview: true,
        collectedById: person.createdById,
      },
    });
    const dossier = await createDossier(ctx);

    // Un dossier vide ne peut pas être soumis.
    assert.equal((await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' })).status, 400);

    await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data: sampleData({ ...ctx, consentId: consent.id, personId: person.id }) });
    const submitted = await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.dossier.status, 'SUBMITTED');

    // Une fois soumis, le collecteur ne modifie plus et ne valide pas.
    assert.equal((await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { title: 'x' })).status, 403);
    assert.equal((await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'UNDER_REVIEW' })).status, 403);
    assert.equal((await put(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/reviews/gastronomie`, { status: 'APPROVED' })).status, 403);

    // Correction ciblée sur une étape : motif obligatoire.
    assert.equal((await put(ctx.admin, `/api/admin/dossiers/${dossier.id}/reviews/gastronomie`, { status: 'CHANGES_REQUESTED' })).status, 400);
    const reviewed = await put(ctx.admin, `/api/admin/dossiers/${dossier.id}/reviews/gastronomie`, { status: 'CHANGES_REQUESTED', comment: 'Préciser la cuisson' });
    assert.equal(reviewed.body.dossier.status, 'UNDER_REVIEW');
    assert.equal((await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' })).status, 400);
    const returned = await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'CHANGES_REQUESTED', comment: 'Voir la gastronomie' });
    assert.equal(returned.body.dossier.status, 'CHANGES_REQUESTED');

    // Le collecteur corrige et resoumet : l'étape repasse « à examiner ».
    const data = sampleData({ ...ctx, consentId: consent.id, personId: person.id });
    data.sections.gastronomie.entries[0].values.cookingTechniques = 'Cuisson lente, au feu de bois.';
    assert.equal((await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data })).status, 200);
    const resubmitted = await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    assert.equal(resubmitted.body.dossier.reviews.gastronomie.status, 'PENDING');

    const validated = await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' });
    assert.equal(validated.status, 200, JSON.stringify(validated.body));
    assert.equal(validated.body.dossier.reviews.gastronomie.status, 'APPROVED');

    // Seul l'administrateur publie.
    assert.equal((await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/publish`, {})).status, 403);
    const published = await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/publish`, { updateCommunity: true, publishCommunity: true });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const { report } = published.body;
    const titles = (list) => list.map((u) => u.title).sort();
    // Une fiche sans source ni témoin est publiée, en « vérification incomplète ».
    assert.deepEqual(titles(report.published), ['Gastronomie et alimentation — Havu', 'Identification de la communauté — Havu', 'Plat documenté', 'Plat sans source']);
    assert.deepEqual(titles(report.sensitive), ['Plat réservé']);
    assert.deepEqual(titles(report.pending), []);
    assert.equal((await prisma.culturalItem.findFirst({ where: { title: 'Plat sans source' } })).verificationStatus, 'INCOMPLETE');
    assert.equal(published.body.dossier.status, 'PUBLISHED');

    // Les fiches publiées sont visibles du public, attribuées au collecteur ;
    // les champs spécialisés de la catégorie sont repris.
    const plat = await prisma.culturalItem.findFirst({ where: { title: 'Plat documenté' }, include: { createdBy: true } });
    assert.equal(plat.createdBy.email, 'collecteur@urithi.cd');
    assert.equal(plat.dossierId, dossier.id);
    // Résumé tiré d'un texte descriptif, jamais du type.
    assert.match(plat.summary, /^Cuisson lente/);
    const pub = await request(app).get(`/api/public/items/${plat.slug}`);
    assert.equal(pub.status, 200);
    assert.deepEqual(pub.body.item.fields.find((f) => f.key === 'ingredients').value, ['manioc', 'haricots']);
    const reserved = await prisma.culturalItem.findFirst({ where: { title: 'Plat réservé' } });
    assert.equal(reserved.status, 'VALIDATED');
    assert.equal(reserved.accessLevel, 'TEAM');
    assert.equal((await request(app).get(`/api/public/items/${reserved.slug}`)).status, 404);

    // Présentation de la communauté mise à jour ; historique et versions conservés.
    const community = await prisma.community.findUnique({ where: { id: ctx.community.id } });
    assert.equal(community.description, 'Présentation documentée de la communauté.');
    assert.equal(community.documentationStatus, 'PARTIAL');
    const detail = await ctx.admin.get(`/api/admin/dossiers/${dossier.id}`);
    assert.ok(detail.body.versions.length >= 4);
    assert.ok(detail.body.events.some((e) => e.type === 'SECTION_REVIEW' && e.sectionKey === 'gastronomie'));
    assert.equal(detail.body.items.length, 5);

    // Republier après correction met à jour les mêmes fiches (nouvelle version).
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'CHANGES_REQUESTED', comment: 'Compléter' });
    await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/publish`, {});
    assert.equal(await prisma.culturalItem.count({ where: { dossierId: dossier.id } }), 5);
    const again = await prisma.culturalItem.findUnique({ where: { id: plat.id } });
    assert.equal(again.currentVersion, 2);
    assert.equal(again.status, 'PUBLISHED');
  });

  test('dossier publié : réouverture par l’administrateur et export complet', async () => {
    const ctx = await team();
    const dossier = await createDossier(ctx);
    await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data: sampleData(ctx) });
    await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/publish`, {});
    // Un dossier publié n'est pas modifiable tel quel…
    assert.equal((await patch(ctx.admin, `/api/admin/dossiers/${dossier.id}`, { title: 'x' })).status, 403);
    // …mais l'administrateur peut le rouvrir, sans passer par le collecteur.
    assert.equal((await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'UNDER_REVIEW' })).status, 403);
    const reopened = await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'UNDER_REVIEW' });
    assert.equal(reopened.body.dossier.status, 'UNDER_REVIEW');
    assert.equal((await patch(ctx.admin, `/api/admin/dossiers/${dossier.id}`, { title: 'Titre corrigé' })).status, 200);

    const exported = await ctx.admin.get('/api/admin/preservation/export');
    assert.equal(exported.status, 200);
    assert.equal(exported.body.version, 2);
    assert.equal(exported.body.data.dossiers.length, 1);
    assert.ok(exported.body.data.dossierEvents.length > 0);
    assert.equal(exported.body.data.dossierSectionDefs.length, 21);
  });

  test('publication : traditions orales, hypothèses et patrimoine matériel bien classés', async () => {
    const ctx = await team();
    const archives = await prisma.category.create({ data: { slug: 'patrimoine-materiel-et-archives', name: 'Patrimoine matériel et archives', code: 'O' } });
    const habitat = await prisma.category.create({ data: { slug: 'habitat', name: 'Habitat et environnement', code: 'K' } });
    const histoire = await prisma.category.create({ data: { slug: 'histoire', name: 'Histoire', code: 'B' } });
    const langue = await prisma.category.create({ data: { slug: 'langues', name: 'Langues', code: 'C' } });
    const src = [{ sourceId: ctx.source.id }];
    const dossier = await createDossier(ctx);
    await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, {
      data: {
        sections: {
          histoire: { entries: [
            { id: 'h1', values: { titre: 'Récit test', nature: 'Récit traditionnel' }, sources: src },
            { id: 'h2', values: { titre: 'Hypothèse test', nature: 'Hypothèse' }, sources: src },
          ] },
          langue: { entries: [{ id: 'l1', values: { originalExpression: 'Conte test', type: 'Conte' }, sources: src }] },
          territoire: { entries: [
            { id: 'o1', values: { nom: 'Objet test', type: 'Objet' }, sources: src },
            { id: 'o2', values: { nom: 'Paysage test', type: 'Paysage' }, sources: src },
          ] },
        },
      },
    });
    await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' });
    const res = await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/publish`, {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const get = (title) => prisma.culturalItem.findFirst({ where: { title } });
    assert.equal((await get('Récit test')).verificationStatus, 'ORAL_TRADITION');
    assert.equal((await get('Hypothèse test')).verificationStatus, 'HYPOTHESIS');
    assert.equal((await get('Conte test')).verificationStatus, 'ORAL_TRADITION');
    assert.equal((await get('Objet test')).categoryId, archives.id);
    assert.equal((await get('Paysage test')).categoryId, habitat.id);
    assert.equal((await get('Récit test')).categoryId, histoire.id);
    assert.equal((await get('Conte test')).categoryId, langue.id);
    // Les collections publiques se remplissent.
    const collections = await request(app).get('/api/public/collections');
    assert.equal(collections.body.collections.oralTraditions, 2);
    assert.equal(collections.body.collections.archives, 1);
  });

  test('autorités et dynasties : fiches courtes, publication et arbre public', async () => {
    const ctx = await team();
    const histoire = await prisma.category.create({ data: { slug: 'histoire', name: 'Histoire', code: 'B' } });
    const src = [{ sourceId: ctx.source.id }];
    const dossier = await createDossier(ctx);
    const saved = await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, {
      data: {
        sections: {
          autorites: {
            values: { organisation: 'Chefferie', lignees: ['Lignée A'] },
            sources: src,
            entries: [
              { id: 'a1', values: { nom: 'Autorité fondatrice', type: 'Chef coutumier', lignee: 'Lignée A', debut: 'vers 1850', fin: '1880', nature: 'Tradition orale' }, sources: src },
              {
                id: 'a2',
                values: {
                  nom: 'Autorité suivante', lignee: 'Lignée A', debut: '1880', nature: 'Fait vérifié', predecesseur: 'a1', parents: ['a1'],
                  liens: [{ target: 'a3', kind: 'Allié' }],
                  evenements: [{ title: 'Campagne test', date: '1885', type: 'Campagne militaire', nature: 'À confirmer' }],
                },
                fieldStatus: { fin: 'UNKNOWN' },
                sources: src,
              },
              { id: 'a3', values: { nom: 'Autorité réservée' }, sensitive: true },
            ],
          },
        },
      },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' });
    const res = await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/publish`, { publishCommunity: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const second = await prisma.culturalItem.findFirst({ where: { title: 'Autorité suivante' } });
    assert.equal(second.categoryId, histoire.id);
    assert.equal(second.dateKind, 'APPROXIMATE');
    assert.match(second.body, /Prédécesseur : Autorité fondatrice/);
    assert.match(second.body, /Campagne test/);
    assert.equal((await prisma.culturalItem.findFirst({ where: { title: 'Autorité fondatrice' } })).verificationStatus, 'ORAL_TRADITION');

    // L'arbre public ne montre que les autorités publiées.
    const tree = await request(app).get(`/api/public/communities/${ctx.community.slug}/authorities`);
    assert.equal(tree.status, 200);
    const { authorities, overview } = tree.body;
    assert.deepEqual(authorities.map((a) => a.name).sort(), ['Autorité fondatrice', 'Autorité suivante']);
    const first = authorities.find((a) => a.name === 'Autorité fondatrice');
    const next = authorities.find((a) => a.name === 'Autorité suivante');
    assert.equal(next.predecessor, first.slug);
    assert.deepEqual(next.parents, [first.slug]);
    assert.deepEqual(next.links, []);
    assert.equal(next.events[0].title, 'Campagne test');
    assert.equal(overview.organisation, 'Chefferie');
    assert.deepEqual(overview.lineages, ['Lignée A']);

    // Une modification par l'éditeur de fiches conserve les données de l'arbre.
    const edited = await patch(ctx.admin, `/api/admin/items/${second.id}`, { summary: 'Résumé revu', fields: {} });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    const fields = JSON.parse((await prisma.culturalItem.findUnique({ where: { id: second.id } })).fields);
    assert.equal(fields.authority.name, 'Autorité suivante');
  });

  test('province et territoires : listes officielles, vérification, anciennes saisies conservées', async () => {
    const { readFileSync } = await import('node:fs');
    const server = readFileSync(new URL('../src/data/rdcDivisions.json', import.meta.url), 'utf8');
    const web = readFileSync(new URL('../../web-app/src/data/rdcDivisions.json', import.meta.url), 'utf8');
    assert.equal(server, web, 'les deux copies des divisions administratives doivent être identiques');
    const { provinces } = JSON.parse(server);
    assert.equal(provinces.length, 26);
    assert.equal(provinces.filter((p) => p.unit === 'territoire').reduce((n, p) => n + p.territories.length, 0), 145);

    const ctx = await team();
    // Une étape créée avant les listes (champs texte) est mise à niveau.
    await ctx.collecteur.get('/api/admin/dossier-sections');
    const def = await prisma.dossierSectionDef.findUnique({ where: { key: 'identification' } });
    const oldFields = [
      ...JSON.parse(def.fields).map((f) => (['province', 'territoire'].includes(f.key) ? { ...f, type: 'text' } : f)),
      { key: 'secteurChefferie', label: 'Secteur ou chefferie', type: 'text' },
      { key: 'localites', label: 'Localités concernées', type: 'list' },
    ];
    await prisma.dossierSectionDef.update({ where: { id: def.id }, data: { fields: JSON.stringify(oldFields) } });
    const sections = (await ctx.collecteur.get('/api/admin/dossier-sections')).body.sections;
    const fields = sections.find((x) => x.key === 'identification').fields;
    assert.equal(fields.find((f) => f.key === 'province').type, 'province');
    assert.equal(fields.find((f) => f.key === 'territoire').type, 'territories');
    assert.ok(!fields.some((f) => ['secteurChefferie', 'localites'].includes(f.key)), 'champs retirés');

    const dossier = await createDossier(ctx);
    const save = (values) => patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data: { sections: { identification: { values } } } });
    // Ancien texte libre : toujours accepté.
    assert.equal((await save({ province: 'Sud Kivu', territoire: 'Kalehe et l’île d’Idjwi' })).status, 200);
    // Territoires cochés : uniquement ceux de la province choisie.
    assert.equal((await save({ province: 'Sud-Kivu', territoire: ['Kalehe', 'Idjwi'] })).status, 200);
    const wrong = await save({ province: 'Sud-Kivu', territoire: ['Kalehe', 'Beni'] });
    assert.equal(wrong.status, 400);
    assert.match(wrong.body.error, /Beni/);
    assert.equal((await save({ territoire: ['Kalehe'] })).status, 400);
    assert.equal((await save({ province: 'Kinshasa', territoire: ['Gombe', 'Ngaliema'] })).status, 200);
    const saved = await ctx.collecteur.get(`/api/admin/dossiers/${dossier.id}`);
    assert.deepEqual(saved.body.dossier.data.sections.identification.values.territoire, ['Gombe', 'Ngaliema']);

    // À la publication, la communauté est rattachée à ses territoires : elle
    // apparaît sur la carte, dans sa province.
    await save({ province: 'Sud-Kivu', territoire: ['Idjwi', 'Kalehe'], presentation: 'Présentation documentée.' });
    await post(ctx.collecteur, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'SUBMITTED' });
    await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/transitions`, { toStatus: 'VALIDATED' });
    assert.equal((await post(ctx.admin, `/api/admin/dossiers/${dossier.id}/publish`, { updateCommunity: true })).status, 200);
    const places = (await request(app).get('/api/public/places')).body.places;
    assert.equal(places.filter((p) => p.type === 'PROVINCE').length, 26);
    const community = (await request(app).get(`/api/public/communities/${ctx.community.slug}`)).body.community;
    assert.deepEqual(community.places.map((p) => `${p.name} (${p.parent})`).sort(), ['Idjwi (Sud-Kivu)', 'Kalehe (Sud-Kivu)']);
  });

  test('étapes personnalisées : réservées à l’administrateur', async () => {
    const ctx = await team();
    const def = { key: 'jeux', title: 'Jeux et divertissements', fields: [{ key: 'jeux', label: 'Jeux traditionnels', type: 'longtext' }] };
    assert.equal((await post(ctx.collecteur, '/api/admin/dossier-sections', def)).status, 403);
    const created = await post(ctx.admin, '/api/admin/dossier-sections', def);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await post(ctx.admin, '/api/admin/dossier-sections', def)).status, 409);
    // Réordonner (PATCH { position }) ne doit pas vider les champs de l'étape.
    const moved = await patch(ctx.admin, `/api/admin/dossier-sections/${created.body.section.id}`, { position: 5 });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.section.position, 5);
    assert.deepEqual(moved.body.section.fields.map((f) => f.key), ['jeux']);
    const dossier = await createDossier(ctx);
    const saved = await patch(ctx.collecteur, `/api/admin/dossiers/${dossier.id}`, { data: { sections: { jeux: { values: { jeux: 'Description' } } } } });
    assert.equal(saved.status, 200);
  });
});
