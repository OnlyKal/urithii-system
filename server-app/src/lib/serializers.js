import { permissionsForRoles } from '../auth/permissions.js';

export function publicUser(user) {
  const roles = user.roles.map((r) => (typeof r === 'string' ? r : r.role));
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles,
    permissions: permissionsForRoles(roles),
  };
}
