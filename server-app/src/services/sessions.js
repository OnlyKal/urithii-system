import { config } from '../config.js';
import { prisma } from '../db.js';
import { generateToken, sha256 } from '../lib/tokens.js';

export async function createSession(userId, { ip, userAgent, ttlMs = config.session.ttlMs }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ip,
      userAgent: userAgent?.slice(0, 500),
    },
  });
  return token;
}

// Session d'une application (jeton porté par l'en-tête Authorization).
export async function createApiToken(userId, { ip, label, userAgent }) {
  const ttlMs = config.session.apiTokenTtlMs;
  const token = await createSession(userId, { ip, ttlMs, userAgent: `API${label ? ` · ${label}` : ''}${userAgent ? ` · ${userAgent}` : ''}` });
  return { token, expiresAt: new Date(Date.now() + ttlMs) };
}

export async function findActiveSession(token) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { roles: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }
  return session;
}

export function revokeSession(id) {
  return prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
}

export function revokeAllUserSessions(userId, db = prisma) {
  return db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
