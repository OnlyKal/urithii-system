import { permissionsForRoles } from '../auth/permissions.js';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findActiveSession } from '../services/sessions.js';

// Jeton d'une application : « Authorization: Bearer <jeton> ».
export function bearerToken(req) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  return match ? match[1] : null;
}

// Charge la session à partir de l'en-tête Authorization ou du cookie du site,
// sans l'exiger.
export async function loadSession(req, res, next) {
  try {
    const token = bearerToken(req) ?? req.cookies?.[config.session.cookieName];
    if (token) {
      const session = await findActiveSession(token);
      if (session) {
        const roles = session.user.roles.map((r) => r.role);
        req.session = session;
        req.user = { ...session.user, roles, permissions: permissionsForRoles(roles) };
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

// Tant que le mot de passe temporaire n'est pas changé, seules les routes
// de compte restent accessibles.
export function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return next(forbidden('Vous devez changer votre mot de passe temporaire'));
  }
  next();
}

export function requirePermission(permission) {
  return [
    requireAuth,
    requirePasswordChanged,
    (req, res, next) => {
      if (!req.user.permissions.includes(permission)) return next(forbidden());
      next();
    },
  ];
}
