import { forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Protection contre la falsification de requêtes (§67), en complément du
// cookie SameSite=Strict : les requêtes qui modifient des données doivent
// provenir du site URITHI.
export function checkOrigin(allowedOrigin) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    // Un jeton porté par l'en-tête Authorization n'est jamais envoyé
    // automatiquement par un navigateur : pas de risque de falsification.
    if (/^Bearer\s+\S+$/i.test(req.get('authorization') ?? '')) return next();
    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin) return next(forbidden('Origine non autorisée'));
    next();
  };
}
