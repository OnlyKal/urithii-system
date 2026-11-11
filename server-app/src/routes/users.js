import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, ROLES } from '../auth/permissions.js';
import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';
import { publicUser } from '../lib/serializers.js';
import { requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recordAudit } from '../services/audit.js';
import { revokeAllUserSessions } from '../services/sessions.js';

// Gestion des comptes (§31, §32, §59). Aucune inscription publique : seuls
// les utilisateurs disposant de `users.manage` créent des comptes.
const router = Router();
router.use(requirePermission(PERMISSIONS.USERS_MANAGE));

const rolesSchema = z.array(z.enum(ROLES)).min(1, 'Au moins un rôle est requis');

async function findUserOr404(id, db = prisma) {
  const user = await db.user.findUnique({ where: { id }, include: { roles: true } });
  if (!user) throw notFound('Utilisateur introuvable');
  return user;
}

// Empêche de se retrouver sans aucun super administrateur actif.
async function assertOtherActiveSuperAdmin(userId, db) {
  const others = await db.user.count({
    where: { id: { not: userId }, isActive: true, roles: { some: { role: 'SUPER_ADMIN' } } },
  });
  if (others === 0) throw badRequest('Il doit rester au moins un super administrateur actif');
}

router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ include: { roles: true }, orderBy: { createdAt: 'asc' } });
    res.json({ users: users.map(publicUser), roles: ROLES });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  displayName: z.string().trim().min(2).max(120),
  roles: rolesSchema,
});

router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    const { email, displayName, roles } = req.body;
    if (await prisma.user.findUnique({ where: { email } })) {
      throw conflict('Un compte existe déjà avec cette adresse e-mail');
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          createdById: req.user.id,
          roles: { create: roles.map((role) => ({ role })) },
        },
        include: { roles: true },
      });
      await recordAudit(
        { actorId: req.user.id, action: 'USER_CREATED', entityType: 'User', entityId: created.id, details: { roles }, ip: req.ip },
        tx,
      );
      return created;
    });

    // Le mot de passe temporaire n'est renvoyé qu'une seule fois.
    res.status(201).json({ user: publicUser(user), temporaryPassword });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    roles: rolesSchema.optional(),
  })
  .refine((v) => v.displayName !== undefined || v.roles !== undefined, 'Aucune modification fournie');

router.patch('/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const { displayName, roles } = req.body;
    const user = await prisma.$transaction(async (tx) => {
      const existing = await findUserOr404(req.params.id, tx);
      const previousRoles = existing.roles.map((r) => r.role);

      if (roles) {
        const losesSuperAdmin = previousRoles.includes('SUPER_ADMIN') && !roles.includes('SUPER_ADMIN');
        if (losesSuperAdmin && existing.isActive) await assertOtherActiveSuperAdmin(existing.id, tx);
        await tx.userRole.deleteMany({ where: { userId: existing.id } });
        await tx.userRole.createMany({ data: roles.map((role) => ({ userId: existing.id, role })) });
        await recordAudit(
          {
            actorId: req.user.id,
            action: 'USER_ROLES_CHANGED',
            entityType: 'User',
            entityId: existing.id,
            details: { from: previousRoles, to: roles },
            ip: req.ip,
          },
          tx,
        );
      }
      if (displayName !== undefined && displayName !== existing.displayName) {
        await tx.user.update({ where: { id: existing.id }, data: { displayName } });
        await recordAudit(
          { actorId: req.user.id, action: 'USER_UPDATED', entityType: 'User', entityId: existing.id, ip: req.ip },
          tx,
        );
      }
      return findUserOr404(existing.id, tx);
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deactivate', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) throw badRequest('Vous ne pouvez pas désactiver votre propre compte');
    const user = await prisma.$transaction(async (tx) => {
      const existing = await findUserOr404(req.params.id, tx);
      if (existing.roles.some((r) => r.role === 'SUPER_ADMIN')) await assertOtherActiveSuperAdmin(existing.id, tx);
      await tx.user.update({ where: { id: existing.id }, data: { isActive: false } });
      await revokeAllUserSessions(existing.id, tx);
      await recordAudit(
        { actorId: req.user.id, action: 'USER_DEACTIVATED', entityType: 'User', entityId: existing.id, ip: req.ip },
        tx,
      );
      return findUserOr404(existing.id, tx);
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivate', async (req, res, next) => {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await findUserOr404(req.params.id, tx);
      await tx.user.update({
        where: { id: existing.id },
        data: { isActive: true, failedLoginCount: 0, lockedUntil: null },
      });
      await recordAudit(
        { actorId: req.user.id, action: 'USER_REACTIVATED', entityType: 'User', entityId: existing.id, ip: req.ip },
        tx,
      );
      return findUserOr404(existing.id, tx);
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await prisma.$transaction(async (tx) => {
      const existing = await findUserOr404(req.params.id, tx);
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
      });
      await revokeAllUserSessions(existing.id, tx);
      await recordAudit(
        { actorId: req.user.id, action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: existing.id, ip: req.ip },
        tx,
      );
    });
    res.json({ temporaryPassword });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revoke-sessions', async (req, res, next) => {
  try {
    const { count } = await prisma.$transaction(async (tx) => {
      const existing = await findUserOr404(req.params.id, tx);
      const result = await revokeAllUserSessions(existing.id, tx);
      await recordAudit(
        { actorId: req.user.id, action: 'USER_SESSIONS_REVOKED', entityType: 'User', entityId: existing.id, details: { count: result.count }, ip: req.ip },
        tx,
      );
      return result;
    });
    res.json({ revoked: count });
  } catch (err) {
    next(err);
  }
});

export default router;
