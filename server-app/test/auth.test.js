import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { app, createUser, loginAs, ORIGIN, prisma, request, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

describe('authentification', () => {
  test('un visiteur accède à la santé de l’API sans compte', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
  });

  test('un visiteur ne peut pas accéder à l’administration', async () => {
    assert.equal((await request(app).get('/api/users')).status, 401);
    assert.equal((await request(app).get('/api/audit')).status, 401);
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
  });

  test('connexion réussie : cookie httpOnly et mot de passe absent de la réponse', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'ADMIN@urithi.cd', password: 'mot-de-passe-solide' });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/i);
    assert.match(res.headers['set-cookie'][0], /SameSite=Strict/i);
    assert.equal(res.body.user.passwordHash, undefined);
    assert.deepEqual(res.body.user.roles, ['SUPER_ADMIN']);
  });

  test('même message pour un e-mail inconnu et un mauvais mot de passe', async () => {
    await createUser({ email: 'a@urithi.cd', roles: ['COLLECTEUR'] });
    const unknown = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'inconnu@urithi.cd', password: 'x' });
    const wrong = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'a@urithi.cd', password: 'x' });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(unknown.body.error, wrong.body.error);
  });

  test('le compte est verrouillé après 5 échecs, même avec le bon mot de passe ensuite', async () => {
    await createUser({ email: 'b@urithi.cd', roles: ['COLLECTEUR'] });
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'b@urithi.cd', password: 'faux' });
    }
    const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'b@urithi.cd', password: 'mot-de-passe-solide' });
    assert.equal(res.status, 401);
    const locked = await prisma.auditLog.count({ where: { action: 'AUTH_ACCOUNT_LOCKED' } });
    assert.equal(locked, 1);
  });

  test('un compte désactivé ne peut pas se connecter', async () => {
    await createUser({ email: 'c@urithi.cd', roles: ['COLLECTEUR'], isActive: false });
    const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'c@urithi.cd', password: 'mot-de-passe-solide' });
    assert.equal(res.status, 401);
  });

  test('une requête venant d’une autre origine est refusée', async () => {
    await createUser({ email: 'd@urithi.cd', roles: ['COLLECTEUR'] });
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://site-malveillant.example')
      .send({ email: 'd@urithi.cd', password: 'mot-de-passe-solide' });
    assert.equal(res.status, 403);
  });

  test('la déconnexion révoque la session', async () => {
    await createUser({ email: 'e@urithi.cd', roles: ['COLLECTEUR'] });
    const agent = await loginAs('e@urithi.cd');
    assert.equal((await agent.get('/api/auth/me')).status, 200);
    assert.equal((await agent.post('/api/auth/logout').set('Origin', ORIGIN)).status, 204);
    const session = await prisma.session.findFirst();
    assert.ok(session.revokedAt);
  });

  test('un mot de passe temporaire doit être changé avant d’utiliser les fonctions protégées', async () => {
    await createUser({ email: 'f@urithi.cd', roles: ['SUPER_ADMIN'], mustChangePassword: true });
    await createUser({ email: 'g@urithi.cd', roles: ['SUPER_ADMIN'] });
    const agent = await loginAs('f@urithi.cd');
    assert.equal((await agent.get('/api/users')).status, 403);

    const tooShort = await agent.post('/api/auth/change-password').set('Origin', ORIGIN)
      .send({ currentPassword: 'mot-de-passe-solide', newPassword: 'court' });
    assert.equal(tooShort.status, 400);

    const changed = await agent.post('/api/auth/change-password').set('Origin', ORIGIN)
      .send({ currentPassword: 'mot-de-passe-solide', newPassword: 'nouveau-mot-de-passe-long' });
    assert.equal(changed.status, 204);
    assert.equal((await agent.get('/api/users')).status, 200);
  });
});

describe('API des applications de collecte (jeton)', () => {
  test('jeton : connexion, collecte complète sans cookie ni origine, révocation', async () => {
    await createUser({ email: 'terrain@urithi.cd', roles: ['COLLECTEUR'] });
    const community = await prisma.community.create({ data: { slug: 'havu', name: 'Havu', isPublished: true, searchText: 'havu' } });
    const api = (method, url, token) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

    // Mauvais identifiants : même réponse que la connexion du site.
    const bad = await request(app).post('/api/auth/token').send({ email: 'terrain@urithi.cd', password: 'faux' });
    assert.equal(bad.status, 401);

    const res = await request(app).post('/api/auth/token').send({ email: 'terrain@urithi.cd', password: 'mot-de-passe-solide', label: 'Téléphone de terrain' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.tokenType, 'Bearer');
    assert.ok(res.body.token.length >= 40);
    assert.ok(new Date(res.body.expiresAt) > new Date(Date.now() + 29 * 24 * 3600 * 1000));
    assert.equal(res.headers['set-cookie'], undefined);
    assert.equal(res.body.user.passwordHash, undefined);
    const { token } = res.body;

    const me = await api('get', '/api/auth/me', token);
    assert.equal(me.body.user.email, 'terrain@urithi.cd');
    assert.ok(me.body.user.permissions.includes('dossiers.collect'));

    // Lecture du formulaire et des listes, création et enregistrement d'un dossier,
    // dépôt d'un fichier, soumission : depuis une application, sans en-tête Origin.
    assert.equal((await api('get', '/api/admin/lookups', token)).status, 200);
    assert.equal((await api('get', '/api/admin/dossier-sections', token)).status, 200);
    const created = await api('post', '/api/admin/dossiers', token).set('Origin', 'capacitor://localhost').send({ communityId: community.id, title: 'Collecte mobile' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.dossier.id;
    const media = await api('post', '/api/admin/media', token).attach('file', Buffer.from('Notes de terrain'), { filename: 'notes.txt', contentType: 'text/plain' }).field('title', 'Notes');
    assert.equal(media.status, 201, JSON.stringify(media.body));
    const data = { sections: { identification: { values: { presentation: 'Présentation recueillie sur le terrain.' }, media: [{ mediaId: media.body.media.id }] } } };
    assert.equal((await api('patch', `/api/admin/dossiers/${id}`, token).send({ data })).status, 200);
    const submitted = await api('post', `/api/admin/dossiers/${id}/transitions`, token).send({ toStatus: 'SUBMITTED' });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.dossier.status, 'SUBMITTED');

    // Les permissions du rôle s'appliquent toujours.
    assert.equal((await api('get', '/api/users', token)).status, 403);
    assert.equal((await api('get', '/api/admin/dossiers/stats', token)).status, 403);

    // Le cookie du site reste protégé contre les autres origines.
    const site = await loginAs('terrain@urithi.cd');
    assert.equal((await site.post('/api/admin/dossiers').set('Origin', 'https://pirate.example').send({ communityId: community.id })).status, 403);

    // Déconnexion avec le jeton : il est révoqué.
    assert.equal((await api('post', '/api/auth/logout', token)).status, 204);
    assert.equal((await api('get', '/api/auth/me', token)).status, 401);
    assert.equal((await api('get', '/api/auth/me', 'jeton-inconnu')).status, 401);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'AUTH_TOKEN_ISSUED' } }));
  });
});
