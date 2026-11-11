// Normalisation pour la recherche : minuscules, sans accents (§14).
export function normalizeSearch(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(value) {
  return normalizeSearch(value).replace(/\s+/g, '-').slice(0, 80) || 'element';
}

// Produit un slug unique pour le modèle Prisma donné (champ `slug`).
export async function uniqueSlug(delegate, base, excludeId) {
  const root = slugify(base);
  for (let i = 1; ; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const existing = await delegate.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
  }
}

export function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}
