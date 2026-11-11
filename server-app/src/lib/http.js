import { z } from 'zod';
import { badRequest } from './errors.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function parseQuery(schema, query) {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest('Paramètres invalides', result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }
  return result.data;
}

export function paginate({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// Champs texte facultatifs : une chaîne vide devient null.
export const optionalText = (max = 20000) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable().optional());

export const optionalId = z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional());

export const optionalDate = z.preprocess(
  (v) => (v === '' || v === undefined ? (v === '' ? null : undefined) : v),
  z.coerce.date().nullable().optional(),
);
