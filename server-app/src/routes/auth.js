import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from '../lib/password.js';
import { publicUser } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recordAudit } from '../services/audit.js';
import { createApiToken, createSession, revokeSession } from '../services/sessions.js';

const router = Router();

const INVALID_CREDENTIALS = 'Identifiants incorrects ou compte temporairement verrouillé';

// Empreinte factice : un e-mail inconnu prend autant de temps qu'un mauvais
// mot de passe, ce qui évite de révéler quels comptes existent.
const dummyHashPromise = hashPassword('urithi-dummy-password');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
  };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
});

// Vérifie les identifiants (verrouillage après plusieurs échecs, compte
// actif) et renvoie l'utilisateur connecté.
async function authenticate(req) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: true } });

  if (!user) {
    await verifyPassword(password, await dummyHashPromise);
    throw unauthorized(INVALID_CREDENTIALS);
  }

  const locked = user.lockedUntil && user.lockedUntil > new Date();
  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!user.isActive || locked || !passwordOk) {
    if (!passwordOk && !locked) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lock = failedLoginCount >= config.login.maxFailedAttempts;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failedLoginCount,
          lockedUntil: lock ? new Date(Date.now() + config.login.lockDurationMs) : undefined,
        },
      });
      await recordAudit({
        action: lock ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        ip: req.ip,
      });
    }
    throw unauthorized(INVALID_CREDENTIALS);
  }

  return prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    include: { roles: true },
  });
}

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const loggedIn = await authenticate(req);
    const token = await createSession(loggedIn.id, { ip: req.ip, userAgent: req.get('user-agent') });
    await recordAudit({ actorId: loggedIn.id, action: 'AUTH_LOGIN', entityType: 'User', entityId: loggedIn.id, ip: req.ip });

    res.cookie(config.session.cookieName, token, { ...cookieOptions(), maxAge: config.session.ttlMs });
    res.json({ user: publicUser(loggedIn) });
  } catch (err) {
    next(err);
  }
});

// Jeton d'accès pour une application de collecte (mobile, script…), à
// envoyer ensuite dans l'en-tête « Authorization: Bearer <jeton> ».
const tokenSchema = loginSchema.extend({ label: z.string().trim().max(100).optional() });

router.post('/token', loginLimiter, validateBody(tokenSchema), async (req, res, next) => {
  try {
    const loggedIn = await authenticate(req);
    const { token, expiresAt } = await createApiToken(loggedIn.id, { ip: req.ip, label: req.body.label, userAgent: req.get('user-agent') });
    await recordAudit({
      actorId: loggedIn.id,
      action: 'AUTH_TOKEN_ISSUED',
      entityType: 'User',
      entityId: loggedIn.id,
      details: req.body.label ? { label: req.body.label } : undefined,
      ip: req.ip,
    });
    res.status(201).json({ token, tokenType: 'Bearer', expiresAt, user: publicUser(loggedIn) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await revokeSession(req.session.id);
    await recordAudit({ actorId: req.user.id, action: 'AUTH_LOGOUT', entityType: 'User', entityId: req.user.id, ip: req.ip });
    res.clearCookie(config.session.cookieName, cookieOptions());
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
    .max(256),
});

router.post('/change-password', requireAuth, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
      throw badRequest('Mot de passe actuel incorrect');
    }
    if (currentPassword === newPassword) {
      throw badRequest('Le nouveau mot de passe doit être différent de l’actuel');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user.id },
        data: { passwordHash, mustChangePassword: false },
      });
      // Les autres sessions sont fermées ; la session courante reste ouverte.
      await tx.session.updateMany({
        where: { userId: req.user.id, revokedAt: null, NOT: { id: req.session.id } },
        data: { revokedAt: new Date() },
      });
      await recordAudit(
        { actorId: req.user.id, action: 'AUTH_PASSWORD_CHANGED', entityType: 'User', entityId: req.user.id, ip: req.ip },
        tx,
      );
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
