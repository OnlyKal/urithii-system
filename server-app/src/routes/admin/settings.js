import { Router } from 'express';
import { z } from 'zod';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  isCustomized,
  loadRolePermissions,
  NO_PERMISSION,
  PERMISSION_LABELS,
  permissionsForRole,
  PERMISSIONS,
  ROLES,
} from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest } from '../../lib/errors.js';
import { validateBody } from '../../middleware/validate.js';
import { audit, need } from './shared.js';

// Paramétrage des permissions par rôle (§37, §59).
const router = Router();
router.use(need(PERMISSIONS.SETTINGS_MANAGE));

router.get('/permissions', async (req, res) => {
  // Nombre de comptes actifs par rôle : les anciens rôles inutilisés peuvent
  // être masqués par l'interface (deux types de comptes sont proposés).
  const usage = await prisma.userRole.groupBy({ by: ['role'], where: { user: { isActive: true } }, _count: { _all: true } });
  res.json({
    permissions: ALL_PERMISSIONS.map((key) => ({ key, label: PERMISSION_LABELS[key] })),
    roles: ROLES.map((role) => ({
      role,
      users: usage.find((u) => u.role === role)?._count._all ?? 0,
      permissions: permissionsForRole(role),
      defaults: DEFAULT_ROLE_PERMISSIONS[role],
      customized: isCustomized(role),
      locked: role === 'SUPER_ADMIN',
    })),
  });
});

router.put(
  '/permissions/:role',
  validateBody(z.object({ permissions: z.array(z.enum(ALL_PERMISSIONS)) })),
  async (req, res) => {
    const { role } = req.params;
    if (!ROLES.includes(role)) throw badRequest('Rôle inconnu');
    if (role === 'SUPER_ADMIN') throw badRequest('Les permissions du super administrateur ne sont pas modifiables');
    const before = permissionsForRole(role);
    const permissions = [...new Set(req.body.permissions)];
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } });
      await tx.rolePermission.createMany({
        data: (permissions.length ? permissions : [NO_PERMISSION]).map((permission) => ({ role, permission })),
      });
      await audit(req, 'ROLE_PERMISSIONS_CHANGED', 'Role', role, { from: before, to: permissions }, tx);
    });
    await loadRolePermissions(prisma);
    res.json({ role, permissions: permissionsForRole(role) });
  },
);

router.delete('/permissions/:role', async (req, res) => {
  const { role } = req.params;
  if (!ROLES.includes(role) || role === 'SUPER_ADMIN') throw badRequest('Rôle invalide');
  await prisma.rolePermission.deleteMany({ where: { role } });
  await audit(req, 'ROLE_PERMISSIONS_RESET', 'Role', role);
  await loadRolePermissions(prisma);
  res.json({ role, permissions: permissionsForRole(role) });
});

export default router;
