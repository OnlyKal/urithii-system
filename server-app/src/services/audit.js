import { prisma } from '../db.js';
import { sha256 } from '../lib/tokens.js';

const GENESIS_HASH = '0'.repeat(64);

function computeHash(entry) {
  const payload = JSON.stringify([
    entry.prevHash,
    entry.createdAt.toISOString(),
    entry.actorId ?? null,
    entry.action,
    entry.entityType ?? null,
    entry.entityId ?? null,
    entry.details ?? null,
    entry.ip ?? null,
  ]);
  return sha256(payload);
}

// Enregistre un événement dans le journal chaîné. `db` permet de l'inclure
// dans la transaction de l'opération journalisée.
export async function recordAudit(
  { actorId, action, entityType, entityId, details, ip },
  db = prisma,
) {
  const write = async (tx) => {
    const last = await tx.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
    const entry = {
      createdAt: new Date(),
      actorId: actorId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      details: details === undefined ? null : JSON.stringify(details),
      ip: ip ?? null,
      prevHash: last?.hash ?? GENESIS_HASH,
    };
    entry.hash = computeHash(entry);
    return tx.auditLog.create({ data: entry });
  };
  return db === prisma ? prisma.$transaction(write) : write(db);
}

// Recalcule toute la chaîne et signale la première entrée incohérente.
export async function verifyAuditChain() {
  const entries = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } });
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== prevHash || computeHash(entry) !== entry.hash) {
      return { valid: false, checked: entries.length, brokenAtId: entry.id };
    }
    prevHash = entry.hash;
  }
  return { valid: true, checked: entries.length };
}
