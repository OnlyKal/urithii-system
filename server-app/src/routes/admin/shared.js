import { forbidden } from '../../lib/errors.js';
import { recordAudit } from '../../services/audit.js';

// Exige au moins une des permissions indiquées.
export const need =
  (...permissions) =>
  (req, res, next) =>
    permissions.some((p) => req.user.permissions.includes(p)) ? next() : next(forbidden());

export const can = (req, permission) => req.user.permissions.includes(permission);

export function audit(req, action, entityType, entityId, details, tx) {
  return recordAudit({ actorId: req.user.id, action, entityType, entityId, details, ip: req.ip }, tx);
}
