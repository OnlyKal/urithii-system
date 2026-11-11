import { badRequest } from '../lib/errors.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(badRequest('Données invalides', result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }))));
    }
    req.body = result.data;
    next();
  };
}
