import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, link, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';

// Stockage local des fichiers originaux (§28, §53, §68).
// - Les fichiers sont rangés hors de tout dossier servi publiquement.
// - Le nom sur disque est un identifiant aléatoire, jamais le nom d'origine.
// - L'écriture échoue si le fichier existe déjà : aucun remplacement silencieux.
// - Les fichiers sont passés en lecture seule après écriture.
// L'accès passe toujours par l'application, qui vérifie les autorisations.

export function resolveKey(storageKey) {
  return path.resolve(config.storageDir, storageKey);
}

export function tempDir() {
  return path.resolve(config.storageDir, 'tmp');
}

async function sha256OfFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function newKey(id) {
  return path.join('originals', id.slice(0, 2), id.slice(2, 4), id);
}

// Enregistre un fichier à partir d'un tampon (`buffer`) ou d'un fichier
// temporaire déjà écrit sur le même disque (`tempPath`, déplacé sans copie).
export async function storeOriginal({ buffer, tempPath, originalName, mimeType, uploadedById, derivedFromId, transformation, db = prisma }) {
  const id = randomUUID();
  const storageKey = newKey(id);
  const filePath = resolveKey(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });

  let sizeBytes;
  let sha256;
  if (tempPath) {
    sha256 = await sha256OfFile(tempPath);
    sizeBytes = (await stat(tempPath)).size;
    await link(tempPath, filePath);
    await unlink(tempPath);
  } else {
    await writeFile(filePath, buffer, { flag: 'wx' });
    sizeBytes = buffer.length;
    sha256 = createHash('sha256').update(buffer).digest('hex');
  }
  await chmod(filePath, 0o440);

  return db.storedFile.create({
    data: { id, originalName, mimeType, sizeBytes, sha256, storageKey, uploadedById, derivedFromId, transformation },
  });
}

export function openStoredFile(storedFile) {
  return createReadStream(resolveKey(storedFile.storageKey));
}

// Contrôle d'intégrité (§54) : recalcule l'empreinte et met à jour le statut.
export async function checkIntegrity(id) {
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) throw notFound('Fichier introuvable');

  let status;
  try {
    status = (await sha256OfFile(resolveKey(file.storageKey))) === file.sha256 ? 'OK' : 'CORRUPTED';
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    status = 'MISSING';
  }

  return prisma.storedFile.update({
    where: { id },
    data: { integrityStatus: status, lastCheckedAt: new Date() },
  });
}
