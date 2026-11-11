import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { isMysql, prisma } from '../db.js';
import { recordAudit } from './audit.js';
import { checkIntegrity } from './storage.js';

// Sauvegarde, vérification et test de restauration (§52 à §54, §87).
//
// Une sauvegarde est un dossier autonome :
//   urithi.db        copie cohérente de la base (API de sauvegarde SQLite)
//   storage/…        tous les fichiers originaux et dérivés
//   manifest.json    liste de chaque fichier avec sa taille et son SHA-256
//   manifest.sha256  empreinte du manifeste lui-même
// Le dossier peut être copié vers un second emplacement (BACKUP_MIRROR_DIR).
// Aucune sauvegarde n'est supprimée automatiquement.

// Base SQLite (développement) : ouverte à la demande, pour ne pas charger le
// module natif en production MySQL.
async function openSqlite(file, options) {
  const { default: Database } = await import('better-sqlite3');
  return new Database(file, options);
}

// Base MySQL (production) : export complet et cohérent par mysqldump.
function mysqlDump(file) {
  const url = new URL(config.databaseUrl);
  const args = [
    '--single-transaction',
    '--routines',
    '--no-tablespaces',
    '--default-character-set=utf8mb4',
    `--host=${url.hostname}`,
    `--port=${url.port || 3306}`,
    `--user=${decodeURIComponent(url.username)}`,
    `--result-file=${file}`,
    url.pathname.slice(1),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.MYSQLDUMP_PATH || 'mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`mysqldump a échoué (${code}) : ${stderr.trim().slice(0, 300)}`))));
  });
}

export function databaseFilePath() {
  return path.resolve(config.databaseUrl.replace(/^file:/, ''));
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function listMigrations() {
  const dir = path.resolve('prisma/migrations');
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

async function startRun(kind, triggeredById) {
  return prisma.backupRun.create({ data: { kind, triggeredById } });
}

async function finishRun(run, { status, location, summary, error }) {
  return prisma.backupRun.update({
    where: { id: run.id },
    data: { status, location, summary: summary ? JSON.stringify(summary) : null, error, finishedAt: new Date() },
  });
}

export async function runBackup({ triggeredById } = {}) {
  const run = await startRun('BACKUP', triggeredById);
  const target = path.resolve(config.backupDir, `urithi-${timestamp()}`);
  try {
    await mkdir(target, { recursive: true });

    const dbName = isMysql ? 'urithi.sql' : 'urithi.db';
    const dbCopy = path.join(target, dbName);
    if (isMysql) {
      await mysqlDump(dbCopy);
    } else {
      const source = await openSqlite(databaseFilePath(), { readonly: true, fileMustExist: true });
      try {
        await source.backup(dbCopy);
      } finally {
        source.close();
      }
    }

    const storageRoot = path.resolve(config.storageDir, 'originals');
    const files = [];
    for await (const file of walk(storageRoot)) {
      const relative = path.relative(path.resolve(config.storageDir), file);
      const destination = path.join(target, 'storage', relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(file, destination);
      files.push({ path: path.join('storage', relative), size: (await stat(destination)).size, sha256: await sha256File(destination) });
    }

    // Dernière entrée du journal d'audit : conservée hors du serveur avec la
    // sauvegarde, elle permet de détecter une réécriture complète de la chaîne.
    const auditHead = await prisma.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { id: true, hash: true } });
    const manifest = {
      application: 'URITHI',
      auditHead,
      createdAt: new Date().toISOString(),
      migrations: await listMigrations(),
      database: { path: dbName, engine: isMysql ? 'mysql' : 'sqlite', size: (await stat(dbCopy)).size, sha256: await sha256File(dbCopy) },
      files,
      counts: {
        storedFiles: await prisma.storedFile.count(),
        items: await prisma.culturalItem.count(),
        media: await prisma.mediaAsset.count(),
        consents: await prisma.consent.count(),
        dossiers: await prisma.collectionDossier.count(),
        auditLogs: await prisma.auditLog.count(),
      },
    };
    const manifestText = JSON.stringify(manifest, null, 2);
    await writeFile(path.join(target, 'manifest.json'), manifestText);
    await writeFile(
      path.join(target, 'manifest.sha256'),
      `${createHash('sha256').update(manifestText).digest('hex')}  manifest.json\n`,
    );

    let mirror = null;
    if (config.backupMirrorDir) {
      mirror = path.resolve(config.backupMirrorDir, path.basename(target));
      await cp(target, mirror, { recursive: true, errorOnExist: true, force: false });
    }

    const summary = { files: files.length, databaseBytes: manifest.database.size, mirror };
    await finishRun(run, { status: 'SUCCESS', location: target, summary });
    await recordAudit({ actorId: triggeredById, action: 'BACKUP_CREATED', entityType: 'BackupRun', entityId: run.id, details: summary });
    return { id: run.id, location: target, ...summary };
  } catch (err) {
    await finishRun(run, { status: 'FAILED', location: target, error: err.message });
    throw err;
  }
}

// Vérifie qu'une sauvegarde est complète et intacte.
export async function verifyBackup(dir) {
  const problems = [];
  const manifestText = await readFile(path.join(dir, 'manifest.json'), 'utf8');
  const expectedManifestHash = (await readFile(path.join(dir, 'manifest.sha256'), 'utf8')).split(/\s+/)[0];
  if (createHash('sha256').update(manifestText).digest('hex') !== expectedManifestHash) {
    problems.push('Le manifeste a été modifié');
  }
  const manifest = JSON.parse(manifestText);
  for (const entry of [manifest.database, ...manifest.files]) {
    try {
      if ((await sha256File(path.join(dir, entry.path))) !== entry.sha256) problems.push(`Fichier altéré : ${entry.path}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      problems.push(`Fichier manquant : ${entry.path}`);
    }
  }
  return { valid: problems.length === 0, problems, manifest };
}

export async function latestBackupDir() {
  const root = path.resolve(config.backupDir);
  try {
    const dirs = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name.startsWith('urithi-'))
      .map((e) => e.name)
      .sort();
    return dirs.length ? path.join(root, dirs.at(-1)) : null;
  } catch {
    return null;
  }
}

// Test d'une sauvegarde MySQL : export complet (terminé par mysqldump),
// fichiers intacts, et chaque fichier référencé par la base présent avec la
// bonne empreinte. La restauration réelle se fait avec le client mysql
// (voir docs/DEPLOIEMENT.md).
async function mysqlRestoreTest({ run, backup, valid, problems, manifest, triggeredById }) {
  const restoredProblems = [...problems];
  const dump = await readFile(path.join(backup, manifest.database.path), 'utf8');
  if (!/-- Dump completed/.test(dump.slice(-500))) restoredProblems.push('Export MySQL incomplet');
  for (const table of ['StoredFile', 'CulturalItem', 'AuditLog']) {
    if (!dump.includes(`CREATE TABLE \`${table}\``)) restoredProblems.push(`Table absente de l'export : ${table}`);
  }
  const hashes = new Map(manifest.files.map((f) => [f.path.replace(/^storage[\\/]/, ''), f.sha256]));
  const rows = await prisma.storedFile.findMany({ where: { createdAt: { lte: new Date(manifest.createdAt) } }, select: { storageKey: true, sha256: true } });
  for (const row of rows) {
    const expected = hashes.get(row.storageKey);
    if (!expected) restoredProblems.push(`Fichier référencé absent de la sauvegarde : ${row.storageKey}`);
    else if (expected !== row.sha256) restoredProblems.push(`Empreinte incohérente : ${row.storageKey}`);
  }
  const success = valid && restoredProblems.length === 0;
  const summary = { backup, counts: manifest.counts, problems: restoredProblems };
  await finishRun(run, { status: success ? 'SUCCESS' : 'FAILED', location: backup, summary, error: success ? null : restoredProblems.slice(0, 5).join(' ; ') });
  await recordAudit({ actorId: triggeredById, action: 'BACKUP_RESTORE_TESTED', entityType: 'BackupRun', entityId: run.id, details: { success } });
  return { success, ...summary };
}

// Test de restauration : la sauvegarde est restaurée dans un dossier
// temporaire, la base est ouverte et chaque fichier référencé est contrôlé.
export async function restoreTest({ dir, triggeredById } = {}) {
  const run = await startRun('RESTORE_TEST', triggeredById);
  const backup = dir ?? (await latestBackupDir());
  if (!backup) {
    await finishRun(run, { status: 'FAILED', error: 'Aucune sauvegarde disponible' });
    throw new Error('Aucune sauvegarde disponible');
  }
  const workdir = await mkdtemp(path.join(os.tmpdir(), 'urithi-restore-'));
  try {
    const { valid, problems, manifest } = await verifyBackup(backup);
    if (manifest.database.engine === 'mysql') return await mysqlRestoreTest({ run, backup, valid, problems, manifest, triggeredById });
    await cp(backup, workdir, { recursive: true });
    const db = await openSqlite(path.join(workdir, 'urithi.db'), { readonly: true });
    const restoredProblems = [...problems];
    let counts;
    try {
      const integrity = db.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') restoredProblems.push(`Base SQLite corrompue : ${integrity}`);
      const hashes = new Map(manifest.files.map((f) => [f.path.replace(/^storage[\\/]/, ''), f.sha256]));
      const rows = db.prepare('SELECT storageKey, sha256 FROM StoredFile').all();
      for (const row of rows) {
        const expected = hashes.get(row.storageKey);
        if (!expected) restoredProblems.push(`Fichier référencé absent de la sauvegarde : ${row.storageKey}`);
        else if (expected !== row.sha256) restoredProblems.push(`Empreinte incohérente : ${row.storageKey}`);
      }
      counts = {
        storedFiles: rows.length,
        items: db.prepare('SELECT COUNT(*) AS n FROM CulturalItem').get().n,
        consents: db.prepare('SELECT COUNT(*) AS n FROM Consent').get().n,
        auditLogs: db.prepare('SELECT COUNT(*) AS n FROM AuditLog').get().n,
      };
      // Les sauvegardes antérieures aux dossiers de collecte n'ont pas cette table.
      const hasDossiers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'CollectionDossier'").get();
      if (hasDossiers) counts.dossiers = db.prepare('SELECT COUNT(*) AS n FROM CollectionDossier').get().n;
    } finally {
      db.close();
    }
    const success = valid && restoredProblems.length === 0;
    const summary = { backup, counts, problems: restoredProblems };
    await finishRun(run, { status: success ? 'SUCCESS' : 'FAILED', location: backup, summary, error: success ? null : restoredProblems.slice(0, 5).join(' ; ') });
    await recordAudit({ actorId: triggeredById, action: 'BACKUP_RESTORE_TESTED', entityType: 'BackupRun', entityId: run.id, details: { success } });
    return { success, ...summary };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function runIntegrityCheck({ triggeredById } = {}) {
  const run = await startRun('INTEGRITY_CHECK', triggeredById);
  try {
    const files = await prisma.storedFile.findMany({ select: { id: true } });
    const counts = { OK: 0, CORRUPTED: 0, MISSING: 0 };
    const failures = [];
    for (const { id } of files) {
      const result = await checkIntegrity(id);
      counts[result.integrityStatus] += 1;
      if (result.integrityStatus !== 'OK') failures.push({ id, status: result.integrityStatus });
    }
    const status = failures.length ? 'FAILED' : 'SUCCESS';
    await finishRun(run, { status, summary: { checked: files.length, counts, failures: failures.slice(0, 100) } });
    await recordAudit({ actorId: triggeredById, action: 'INTEGRITY_CHECKED', entityType: 'BackupRun', entityId: run.id, details: counts });
    return { checked: files.length, counts, failures };
  } catch (err) {
    await finishRun(run, { status: 'FAILED', error: err.message });
    throw err;
  }
}
