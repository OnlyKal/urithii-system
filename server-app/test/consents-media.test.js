import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { config } from '../src/config.js';
import { createVideoDerivative, createVideoPoster, ffmpegAvailable } from '../src/services/media.js';
import { app, loginAs, prisma, request, resetDatabase, setupTeam, validateItem, withOrigin } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function context() {
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

const png = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#a0522d' } }).png().toBuffer();

async function upload(agent, buffer, { filename = 'photo.png', contentType = 'image/png', fields = {} } = {}) {
  let req = withOrigin(agent.post('/api/admin/media')).attach('file', buffer, { filename, contentType });
  for (const [k, v] of Object.entries({ title: 'Photo de test', ...fields })) req = req.field(k, v);
  return req;
}

async function testimony(ctx, consentOverrides = {}) {
  const person = await withOrigin(ctx.agents.collecteur.post('/api/admin/persons'))
    .send({ fullName: 'Nom Réel Confidentiel', publicName: 'Mama K.', attributionMode: 'PSEUDONYM', contact: '+243 000' });
  const consent = await withOrigin(ctx.agents.collecteur.post('/api/admin/consents')).send({
    resourcePersonId: person.body.person.id,
    collectedAt: new Date().toISOString(),
    canProcess: true,
    canPublish: true,
    allowsAudio: true,
    attribution: 'PSEUDONYM',
    ...consentOverrides,
  });
  assert.equal(consent.status, 201, JSON.stringify(consent.body));
  const item = await withOrigin(ctx.agents.collecteur.post('/api/admin/items')).send({
    title: 'Récit de la fondation du village',
    summary: 'Tradition orale recueillie auprès d’une ancienne.',
    categoryId: ctx.category.id,
    communityIds: [ctx.community.id],
    verificationStatus: 'ORAL_TRADITION',
    accessLevel: 'PUBLIC',
    resourcePersonId: person.body.person.id,
    consentIds: [consent.body.consent.id],
  });
  assert.equal(item.status, 201, JSON.stringify(item.body));
  return { person: person.body.person, consent: consent.body.consent, item: item.body.item };
}

describe('consentements', () => {
  test('un témoignage publié n’expose que le pseudonyme autorisé', async () => {
    const ctx = await context();
    const { item } = await testimony(ctx);
    await validateItem(item.id, ctx.agents);
    const res = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const pub = await request(app).get(`/api/public/items/${item.slug}`);
    assert.equal(pub.body.item.narrator, 'Mama K.');
    assert.doesNotMatch(JSON.stringify(pub.body), /Nom Réel Confidentiel|\+243/);
  });

  test('les consentements ne bloquent plus la publication (décision du porteur du projet)', async () => {
    const ctx = await context();
    // Consentement expiré et sans droit de publication : la fiche est tout de même publiable.
    const { item } = await testimony(ctx, { canPublish: false, validUntil: new Date(Date.now() - 86_400_000).toISOString() });
    await validateItem(item.id, ctx.agents);
    const res = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // Le témoin reste présenté sous le seul nom autorisé.
    const pub = await request(app).get(`/api/public/items/${item.slug}`);
    assert.equal(pub.body.item.narrator, 'Mama K.');
  });

  test('mineur : l’accord du représentant légal est exigé', async () => {
    const ctx = await context();
    const person = await withOrigin(ctx.agents.collecteur.post('/api/admin/persons')).send({ fullName: 'Enfant', isMinor: true });
    const consent = await withOrigin(ctx.agents.collecteur.post('/api/admin/consents'))
      .send({ resourcePersonId: person.body.person.id, collectedAt: new Date().toISOString(), canPublish: true });
    assert.ok(consent.body.consent.publicationProblems.some((p) => p.includes('représentant légal')));
  });

  test('la révocation suspend immédiatement la fiche publiée', async () => {
    const ctx = await context();
    const { item, consent } = await testimony(ctx);
    await validateItem(item.id, ctx.agents);
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal((await request(app).get(`/api/public/items/${item.slug}`)).status, 200);

    const revoke = await withOrigin(ctx.agents.collecteur.post(`/api/admin/consents/${consent.id}/revoke`)).send({ reason: 'Demande de la personne' });
    assert.equal(revoke.status, 200);
    assert.deepEqual(revoke.body.suspendedItems, [item.id]);
    assert.equal((await request(app).get(`/api/public/items/${item.slug}`)).status, 404);

    const edit = await withOrigin(ctx.agents.collecteur.patch(`/api/admin/consents/${consent.id}`)).send({ canPublish: true });
    assert.equal(edit.status, 400);
  });

  test('les données des personnes ressources sont réservées', async () => {
    const ctx = await context();
    await testimony(ctx);
    assert.equal((await ctx.agents.editeur.get('/api/admin/persons')).status, 403);
    assert.equal((await ctx.agents.validateur.get('/api/admin/consents')).status, 403);
  });
});

describe('médias', () => {
  test('téléversement : original intact, version web et miniature générées', async () => {
    const ctx = await context();
    const buffer = await png();
    const res = await upload(ctx.agents.collecteur, buffer);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const media = await prisma.mediaAsset.findUnique({
      where: { id: res.body.media.id },
      include: { originalFile: true, webFile: true, thumbnailFile: true },
    });
    assert.equal(media.kind, 'PHOTO');
    assert.equal(media.accessLevel, 'PRIVATE');
    assert.equal(media.originalFile.sizeBytes, buffer.length);
    assert.equal(media.webFile.derivedFromId, media.originalFileId);
    assert.equal(media.thumbnailFile.mimeType, 'image/webp');

    const file = await ctx.agents.collecteur.get(`/api/admin/media/${media.id}/file`).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.ok(Buffer.compare(file.body, buffer) === 0);
  });

  test('un fichier dont le contenu ne correspond pas au format est refusé', async () => {
    const ctx = await context();
    const fake = Buffer.from('<script>alert(1)</script>');
    assert.equal((await upload(ctx.agents.collecteur, fake)).status, 400);
    const svg = await upload(ctx.agents.collecteur, Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    assert.equal(svg.status, 400);
    const files = await prisma.storedFile.count();
    assert.equal(files, 0);
  });

  test('un média « Public » est diffusé dès que sa fiche est publiée', async () => {
    const ctx = await context();
    const up = await upload(ctx.agents.editeur, await png(), { fields: { accessLevel: 'PUBLIC' } });
    const mediaId = up.body.media.id;
    // Tant qu'il n'illustre aucune fiche publiée, il reste invisible.
    assert.equal((await request(app).get(`/api/public/media/${mediaId}/file`)).status, 404);

    const item = await withOrigin(ctx.agents.collecteur.post('/api/admin/items')).send({
      title: 'Plat illustré',
      summary: 'Résumé',
      categoryId: ctx.category.id,
      communityIds: [ctx.community.id],
      sources: [{ sourceId: ctx.source.id }],
      media: [{ mediaId, caption: 'Le plat servi' }],
      accessLevel: 'PUBLIC',
    });
    await validateItem(item.body.item.id, ctx.agents);
    // Sans consentement ni confirmation des droits : la publication passe.
    const ok = await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.body.item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));

    const file = await request(app).get(`/api/public/media/${mediaId}/file`);
    assert.equal(file.status, 200);
    assert.equal(file.headers['content-type'], 'image/webp');
    const pub = await request(app).get(`/api/public/items/${item.body.item.slug}`);
    assert.equal(pub.body.item.media[0].caption, 'Le plat servi');

    // Repassé en privé : plus accessible publiquement, même avec l'URL.
    await withOrigin(ctx.agents.editeur.patch(`/api/admin/media/${mediaId}`)).send({ accessLevel: 'PRIVATE' });
    assert.equal((await request(app).get(`/api/public/media/${mediaId}/file`)).status, 404);
  });

  test('vidéos : H.264 accepté tel quel, HEVC et MOV acceptés pour conversion si ffmpeg est présent', async () => {
    const ctx = await context();
    const box = (type, ...children) => {
      const body = Buffer.concat(children);
      const head = Buffer.alloc(8);
      head.writeUInt32BE(8 + body.length);
      head.write(type, 4, 'latin1');
      return Buffer.concat([head, body]);
    };
    const mp4 = (brand, codec) => {
      const entry = Buffer.alloc(16);
      entry.writeUInt32BE(16);
      entry.write(codec, 4, 'latin1');
      const stsd = box('stsd', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), entry);
      return Buffer.concat([box('ftyp', Buffer.from(`${brand}\0\0\0\0isom`, 'latin1')), box('moov', box('trak', box('mdia', box('minf', box('stbl', stsd)))))]);
    };
    const send = (buffer, filename, contentType) => upload(ctx.agents.editeur, buffer, { filename, contentType });

    const h264 = await send(mp4('isom', 'avc1'), 'danse.mp4', 'video/mp4');
    assert.equal(h264.status, 201, JSON.stringify(h264.body));
    assert.equal(h264.body.media.kind, 'VIDEO');
    const converter = await ffmpegAvailable();
    const hevc = await send(mp4('isom', 'hvc1'), 'iphone.mp4', 'video/mp4');
    const mov = await send(mp4('qt  ', 'avc1'), 'clip.mov', 'video/quicktime');
    if (converter) {
      assert.equal(hevc.status, 201, JSON.stringify(hevc.body));
      assert.equal(hevc.body.media.kind, 'VIDEO');
      assert.equal(mov.status, 201, JSON.stringify(mov.body));
    } else {
      assert.equal(hevc.status, 400);
      assert.match(hevc.body.error, /H\.264/);
      assert.equal(mov.status, 400);
    }
    // Type non annoncé par le navigateur : déduit de l'extension, puis vérifié.
    const anonymous = await send(mp4('isom', 'avc1'), 'sans-type.mp4', 'application/octet-stream');
    assert.equal(anonymous.status, 201, JSON.stringify(anonymous.body));
    // Formats retirés : WebM, MKV, OGG, FLAC.
    assert.equal((await send(Buffer.from('OggS\0\0\0\0'), 'chant.ogg', 'audio/ogg')).status, 400);
    assert.equal((await send(Buffer.from('fLaC\0\0\0\0'), 'chant.flac', 'audio/flac')).status, 400);
    // Un M4A envoyé depuis un Mac (audio/x-m4a) est accepté et enregistré en audio/mp4.
    const m4a = await send(mp4('M4A ', 'mp4a'), 'chant.m4a', 'audio/x-m4a');
    assert.equal(m4a.status, 201, JSON.stringify(m4a.body));
    assert.equal(m4a.body.media.kind, 'AUDIO');
    const stored = await prisma.mediaAsset.findUnique({ where: { id: m4a.body.media.id }, include: { originalFile: true } });
    assert.equal(stored.originalFile.mimeType, 'audio/mp4');
  });

  test('conversion réelle d’une vidéo non H.264 en version de consultation H.264', async (t) => {
    if (!(await ffmpegAvailable())) return t.skip('ffmpeg absent');
    const ctx = await context();
    const dir = await mkdtemp(path.join(os.tmpdir(), 'urithi-video-'));
    const source = path.join(dir, 'mpeg4.mp4');
    await promisify(execFile)(config.ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=25', '-t', '1', '-c:v', 'mpeg4', source]);
    const res = await upload(ctx.agents.editeur, await readFile(source), { filename: 'ancienne.mp4', contentType: 'video/mp4', fields: { title: 'Vidéo', accessLevel: 'PUBLIC' } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    await createVideoDerivative(res.body.media.id);
    const media = await prisma.mediaAsset.findUnique({ where: { id: res.body.media.id }, include: { webFile: true, originalFile: true } });
    assert.ok(media.webFile, 'version de consultation créée');
    assert.equal(media.webFile.mimeType, 'video/mp4');
    assert.equal(media.webFile.derivedFromId, media.originalFile.id);
    // La version de consultation est servie ; l'original reste intact.
    const served = await ctx.agents.editeur.get(`/api/admin/media/${media.id}/file?variant=web`);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-length'], String(media.webFile.sizeBytes));
    assert.notEqual(media.webFile.sha256, media.originalFile.sha256);
    // Image de couverture extraite de la vidéo (WebP), servie comme miniature.
    await createVideoPoster(media.id);
    const withPoster = await prisma.mediaAsset.findUnique({ where: { id: media.id }, include: { thumbnailFile: true } });
    assert.equal(withPoster.thumbnailFile?.mimeType, 'image/webp');
    assert.equal(withPoster.thumbnailFile.derivedFromId, media.originalFile.id);
    const poster = await ctx.agents.editeur.get(`/api/admin/media/${media.id}/file?variant=thumbnail`);
    assert.equal(poster.status, 200);
    assert.match(poster.headers['content-type'], /image\/webp/);
    await rm(dir, { recursive: true, force: true });
  });

  test('médiathèque publique : consultation, contexte, filtres et téléchargement', async () => {
    const ctx = await context();
    const pub = await upload(ctx.agents.editeur, await png(), { fields: { title: 'Danse du village', accessLevel: 'PUBLIC' } });
    const hidden = await upload(ctx.agents.editeur, await png(), { fields: { title: 'Photo interne', accessLevel: 'PRIVATE' } });
    const mediaId = pub.body.media.id;
    const item = await withOrigin(ctx.agents.collecteur.post('/api/admin/items')).send({
      title: 'Fête du village',
      summary: 'Résumé',
      categoryId: ctx.category.id,
      communityIds: [ctx.community.id],
      sources: [{ sourceId: ctx.source.id }],
      media: [{ mediaId }, { mediaId: hidden.body.media.id }],
      accessLevel: 'PUBLIC',
    });
    await validateItem(item.body.item.id, ctx.agents);
    await withOrigin(ctx.agents.editeur.post(`/api/admin/items/${item.body.item.id}/transitions`)).send({ toStatus: 'PUBLISHED' });

    // Page de consultation : contexte culturel issu des fiches publiques.
    const detail = await request(app).get(`/api/public/media/${mediaId}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.media.communities[0].slug, ctx.community.slug);
    assert.equal(detail.body.media.categories[0].slug, ctx.category.slug);
    assert.equal(detail.body.media.items[0].title, 'Fête du village');
    assert.equal(detail.body.media.downloadable, false);
    // Le média privé n'est ni consultable ni proposé parmi les médias associés.
    assert.equal((await request(app).get(`/api/public/media/${hidden.body.media.id}`)).status, 404);
    assert.ok(detail.body.related.every((m) => m.id !== hidden.body.media.id));

    // Filtres par catégorie et par date d'ajout.
    const byCategory = await request(app).get(`/api/public/media?category=${ctx.category.slug}&added=month&sort=title`);
    assert.deepEqual(byCategory.body.media.map((m) => m.id), [mediaId]);
    assert.equal((await request(app).get('/api/public/media?category=inconnue')).body.total, 0);

    // Téléchargement refusé tant que les droits ne sont pas confirmés.
    const inline = await request(app).get(`/api/public/media/${mediaId}/file?download=1`);
    assert.equal(inline.headers['content-disposition'], 'inline');
    await withOrigin(ctx.agents.editeur.patch(`/api/admin/media/${mediaId}`)).send({ publicationCleared: true });
    const dl = await request(app).get(`/api/public/media/${mediaId}/file?download=1`);
    assert.match(dl.headers['content-disposition'], /^attachment/);
    assert.equal((await request(app).get(`/api/public/media/${mediaId}`)).body.media.downloadable, true);
  });

  test('contrôle d’intégrité d’un média', async () => {
    const ctx = await context();
    const up = await upload(ctx.agents.collecteur, await png());
    const res = await withOrigin(ctx.agents.collecteur.post(`/api/admin/media/${up.body.media.id}/check-integrity`));
    assert.equal(res.status, 200);
    assert.ok(res.body.files.every((f) => f.integrityStatus === 'OK'));
  });
});

describe('transcriptions et traductions', () => {
  test('vérification par une autre personne, remise à zéro après révision', async () => {
    const ctx = await context();
    const transcripteur = await (await import('./helpers.js')).createUser({ email: 't@urithi.cd', roles: ['TRANSCRIPTEUR'] });
    const t2 = await (await import('./helpers.js')).createUser({ email: 't2@urithi.cd', roles: ['TRANSCRIPTEUR'] });
    const a = await loginAs('t@urithi.cd');
    const b = await loginAs('t2@urithi.cd');
    const language = await prisma.language.create({ data: { name: 'Kihavu' } });
    const up = await upload(ctx.agents.collecteur, await png());

    const created = await withOrigin(a.post('/api/admin/texts')).send({
      kind: 'TRANSCRIPTION', mediaId: up.body.media.id, languageId: language.id, method: 'AUTOMATIC', content: '[00:00:01] texte',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.text.id;
    assert.equal(created.body.text.verification, 'UNVERIFIED');

    assert.equal((await withOrigin(a.post(`/api/admin/texts/${id}/verify`))).status, 403);
    assert.equal((await withOrigin(b.post(`/api/admin/texts/${id}/verify`))).body.text.verification, 'VERIFIED');

    const revised = await withOrigin(b.post(`/api/admin/texts/${id}/revisions`)).send({ content: '[00:00:01] texte corrigé', reason: 'Correction' });
    assert.equal(revised.body.text.verification, 'UNVERIFIED');
    assert.equal(revised.body.text.currentVersion, 2);

    // Un traducteur sans droit de transcription ne peut pas créer de transcription.
    assert.equal(
      (await withOrigin(ctx.agents.validateur.post('/api/admin/texts')).send({ kind: 'TRANSCRIPTION', mediaId: up.body.media.id, languageId: language.id, content: 'x' })).status,
      403,
    );
    void transcripteur;
    void t2;
  });
});
