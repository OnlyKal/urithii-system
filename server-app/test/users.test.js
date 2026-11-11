import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { createUser, loginAs, ORIGIN, prisma, request, app, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

describe('gestion des comptes', () => {
  test('le super administrateur crée un compte avec mot de passe temporaire', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const admin = await loginAs('admin@urithi.cd');

    const res = await admin.post('/api/users').set('Origin', ORIGIN)
      .send({ email: 'collecteur@urithi.cd', displayName: 'Collecteur Havu', roles: ['COLLECTEUR'] });
    assert.equal(res.status, 201);
    assert.ok(res.body.temporaryPassword);
    assert.equal(res.body.user.mustChangePassword, true);

    const login = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'collecteur@urithi.cd', password: res.body.temporaryPassword });
    assert.equal(login.status, 200);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'USER_CREATED' } });
    assert.equal(audit.entityId, res.body.user.id);
  });

  test('un compte sans la permission ne peut pas gérer les comptes', async () => {
    await createUser({ email: 'editeur@urithi.cd', roles: ['EDITEUR'] });
    const editeur = await loginAs('editeur@urithi.cd');
    const res = await editeur.post('/api/users').set('Origin', ORIGIN)
      .send({ email: 'x@urithi.cd', displayName: 'X', roles: ['SUPER_ADMIN'] });
    assert.equal(res.status, 403);
    assert.equal(await prisma.user.count({ where: { email: 'x@urithi.cd' } }), 0);
  });

  test('il n’existe pas d’inscription publique', async () => {
    const res = await request(app).post('/api/users').set('Origin', ORIGIN)
      .send({ email: 'x@urithi.cd', displayName: 'X', roles: ['COLLECTEUR'] });
    assert.equal(res.status, 401);
  });

  test('un rôle inconnu est refusé', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const admin = await loginAs('admin@urithi.cd');
    const res = await admin.post('/api/users').set('Origin', ORIGIN)
      .send({ email: 'x@urithi.cd', displayName: 'X', roles: ['DIEU'] });
    assert.equal(res.status, 400);
  });

  test('la désactivation révoque immédiatement les sessions', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const target = await createUser({ email: 'col@urithi.cd', roles: ['COLLECTEUR'] });
    const admin = await loginAs('admin@urithi.cd');
    const collecteur = await loginAs('col@urithi.cd');
    assert.equal((await collecteur.get('/api/auth/me')).status, 200);

    const res = await admin.post(`/api/users/${target.id}/deactivate`).set('Origin', ORIGIN);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.isActive, false);
    assert.equal((await collecteur.get('/api/auth/me')).status, 401);
  });

  test('impossible de retirer le dernier super administrateur actif', async () => {
    const admin = await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const agent = await loginAs('admin@urithi.cd');
    const res = await agent.patch(`/api/users/${admin.id}`).set('Origin', ORIGIN).send({ roles: ['EDITEUR'] });
    assert.equal(res.status, 400);
    const self = await agent.post(`/api/users/${admin.id}/deactivate`).set('Origin', ORIGIN);
    assert.equal(self.status, 400);
  });

  test('le changement de rôles est journalisé avec l’ancien et le nouveau rôle', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const target = await createUser({ email: 'col@urithi.cd', roles: ['COLLECTEUR'] });
    const admin = await loginAs('admin@urithi.cd');
    const res = await admin.patch(`/api/users/${target.id}`).set('Origin', ORIGIN)
      .send({ roles: ['COLLECTEUR', 'TRANSCRIPTEUR'] });
    assert.equal(res.status, 200);
    assert.ok(res.body.user.permissions.includes('transcription.edit'));

    const entry = await prisma.auditLog.findFirst({ where: { action: 'USER_ROLES_CHANGED' } });
    assert.deepEqual(JSON.parse(entry.details), { from: ['COLLECTEUR'], to: ['COLLECTEUR', 'TRANSCRIPTEUR'] });
  });

  test('la réinitialisation du mot de passe invalide l’ancien', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    const target = await createUser({ email: 'col@urithi.cd', roles: ['COLLECTEUR'] });
    const admin = await loginAs('admin@urithi.cd');
    const res = await admin.post(`/api/users/${target.id}/reset-password`).set('Origin', ORIGIN);
    assert.equal(res.status, 200);

    const old = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'col@urithi.cd', password: 'mot-de-passe-solide' });
    assert.equal(old.status, 401);
    const fresh = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'col@urithi.cd', password: res.body.temporaryPassword });
    assert.equal(fresh.status, 200);
  });
});
