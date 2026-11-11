import assert from 'node:assert/strict';
import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, beforeEach, describe, test } from 'node:test';
import { config } from '../src/config.js';
import { recordAudit, verifyAuditChain } from '../src/services/audit.js';
import { checkIntegrity, storeOriginal } from '../src/services/storage.js';
import { createUser, loginAs, prisma, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

describe('journal d’audit', () => {
  test('la chaîne est valide puis détecte une modification', async () => {
    await recordAudit({ action: 'TEST_A' });
    await recordAudit({ action: 'TEST_B', details: { x: 1 } });
    await recordAudit({ action: 'TEST_C' });
    assert.deepEqual(await verifyAuditChain(), { valid: true, checked: 3 });

    const second = await prisma.auditLog.findFirst({ where: { action: 'TEST_B' } });
    await prisma.auditLog.update({ where: { id: second.id }, data: { details: '{"x":2}' } });
    const result = await verifyAuditChain();
    assert.equal(result.valid, false);
    assert.equal(result.brokenAtId, second.id);
  });

  test('la suppression d’une entrée est détectée', async () => {
    await recordAudit({ action: 'TEST_A' });
    const middle = await recordAudit({ action: 'TEST_B' });
    await recordAudit({ action: 'TEST_C' });
    await prisma.auditLog.delete({ where: { id: middle.id } });
    assert.equal((await verifyAuditChain()).valid, false);
  });

  test('seuls les détenteurs de audit.read consultent le journal', async () => {
    await createUser({ email: 'admin@urithi.cd', roles: ['SUPER_ADMIN'] });
    await createUser({ email: 'col@urithi.cd', roles: ['COLLECTEUR'] });
    const admin = await loginAs('admin@urithi.cd');
    const collecteur = await loginAs('col@urithi.cd');

    const res = await admin.get('/api/audit');
    assert.equal(res.status, 200);
    assert.ok(res.body.entries.some((e) => e.action === 'AUTH_LOGIN'));
    assert.equal((await admin.get('/api/audit/verify')).body.valid, true);
    assert.equal((await collecteur.get('/api/audit')).status, 403);
  });
});

describe('stockage des originaux', () => {
  test('conserve l’original, son empreinte, et détecte une corruption', async () => {
    const user = await createUser({ email: 'col@urithi.cd', roles: ['COLLECTEUR'] });
    const file = await storeOriginal({
      buffer: Buffer.from('enregistrement original'),
      originalName: 'temoignage.wav',
      mimeType: 'audio/wav',
      uploadedById: user.id,
    });
    assert.equal(file.sizeBytes, 23);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!file.storageKey.includes('temoignage'));
    assert.equal((await checkIntegrity(file.id)).integrityStatus, 'OK');

    const filePath = path.resolve(config.storageDir, file.storageKey);
    await chmod(filePath, 0o640);
    await writeFile(filePath, 'contenu altéré');
    assert.equal((await checkIntegrity(file.id)).integrityStatus, 'CORRUPTED');
  });
});
