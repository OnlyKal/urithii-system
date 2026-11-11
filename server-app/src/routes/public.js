import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { optionalText, paginate, paginationSchema, parseQuery } from '../lib/http.js';
import { normalizeSearch } from '../lib/text.js';
import { validateBody } from '../middleware/validate.js';
import { publicItemWhere, publicMediaWhere } from '../services/access.js';
import { recordAudit } from '../services/audit.js';
import { exportPublic } from '../services/export.js';
import {
  communityAuthorities,
  communityCover,
  hydratePublicItem,
  publicCardSelect,
  serializePublicMedia,
  toPublicCards,
} from '../services/publicContent.js';
import { resolveKey } from '../services/storage.js';

// API publique (§7, §13 à §17). Consultation libre, sans compte. Ne renvoie
// jamais de contenu non publié, restreint, ni de données personnelles.
const router = Router();

// Les caches doivent revalider chaque réponse (ETag, réponse 304 si rien n'a
// changé) : une publication est visible immédiatement, et un contenu retiré ou
// restreint cesse aussitôt d'être servi depuis un cache (§47, §66).
router.use((req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'no-cache');
  next();
});

// Recherche insensible aux accents : chaque mot doit apparaître (§14).
function searchConditions(q, field = 'searchText') {
  return normalizeSearch(q)
    .split(' ')
    .filter(Boolean)
    .slice(0, 10)
    .map((term) => ({ [field]: { contains: term } }));
}

const publicCommunityWhere = { isPublished: true };

// Un lieu et tous ceux qu'il contient (province → territoires → localités…) :
// explorer une province inclut ce qui est documenté dans ses subdivisions (§9).
async function placeAndDescendants(placeId) {
  const places = await prisma.place.findMany({ select: { id: true, parentId: true } });
  const ids = [placeId];
  for (let i = 0; i < ids.length; i++) {
    for (const p of places) if (p.parentId === ids[i]) ids.push(p.id);
  }
  return ids;
}

// ----- Accueil ------------------------------------------------------------

router.get('/home', async (req, res) => {
  const [stats, recent, updated, communities, categories, archives] = await Promise.all([
    publicStats(),
    prisma.culturalItem.findMany({ where: publicItemWhere, orderBy: { publishedAt: 'desc' }, take: 6, select: publicCardSelect }),
    prisma.culturalItem.findMany({
      where: publicItemWhere,
      orderBy: { publishedVersion: { publishedAt: 'desc' } },
      take: 6,
      select: publicCardSelect,
    }),
    listCommunities({}, 8),
    publicCategories(),
    prisma.culturalItem.findMany({
      where: { ...publicItemWhere, category: { code: 'O' } },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: publicCardSelect,
    }),
  ]);
  res.json({
    stats,
    recent: await toPublicCards(recent),
    updated: await toPublicCards(updated.filter((i) => i.publishedVersion?.publishedAt > i.publishedAt)),
    communities,
    categories,
    archives: await toPublicCards(archives),
    collections: await collectionCounts(),
  });
});

async function publicStats() {
  const [communities, items, media] = await Promise.all([
    prisma.community.count({ where: publicCommunityWhere }),
    prisma.culturalItem.count({ where: publicItemWhere }),
    prisma.mediaAsset.count({ where: publicMediaWhere() }),
  ]);
  return { communities, items, media };
}

async function publicCategories() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      code: true,
      description: true,
      parentId: true,
      _count: { select: { items: { where: publicItemWhere } } },
    },
  });
  return categories.map(({ _count, ...c }) => ({ ...c, itemCount: _count.items }));
}

router.get('/categories', async (req, res) => {
  res.json({ categories: await publicCategories() });
});

// ----- Communautés --------------------------------------------------------

async function listCommunities({ q = '', placeId }, take) {
  const placeIds = placeId ? await placeAndDescendants(placeId) : null;
  const communities = await prisma.community.findMany({
    where: {
      ...publicCommunityWhere,
      AND: searchConditions(q),
      ...(placeIds && { places: { some: { placeId: { in: placeIds } } } }),
    },
    orderBy: { name: 'asc' },
    take,
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      documentationStatus: true,
      names: { select: { name: true, kind: true } },
      places: { select: { place: { select: { name: true, type: true } } } },
      _count: { select: { items: { where: { item: publicItemWhere } } } },
    },
  });
  return Promise.all(
    communities.map(async ({ _count, places, id, ...c }) => ({
      ...c,
      places: places.map((p) => p.place),
      itemCount: _count.items,
      cover: await communityCover(id),
    })),
  );
}

// Effectifs réels des grandes collections (§13, §17).
async function collectionCounts() {
  const media = (kind) => prisma.mediaAsset.count({ where: { AND: [{ kind }, publicMediaWhere()] } });
  const [archives, testimonies, oralTraditions, photos, videos, audios] = await Promise.all([
    prisma.culturalItem.count({ where: { ...publicItemWhere, category: { code: 'O' } } }),
    prisma.culturalItem.count({ where: { ...publicItemWhere, verificationStatus: 'TESTIMONY' } }),
    prisma.culturalItem.count({ where: { ...publicItemWhere, verificationStatus: 'ORAL_TRADITION' } }),
    media('PHOTO'),
    media('VIDEO'),
    media('AUDIO'),
  ]);
  return { archives, testimonies, oralTraditions, photos, videos, audios };
}

router.get('/collections', async (req, res) => {
  res.json({ collections: await collectionCounts() });
});

router.get('/communities', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const placeId = typeof req.query.placeId === 'string' ? req.query.placeId : undefined;
  res.json({ communities: await listCommunities({ q, placeId }) });
});

router.get('/communities/:slug', async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { slug: req.params.slug, ...publicCommunityWhere },
    include: {
      names: { include: { source: { select: { title: true, isPublic: true } } } },
      places: { include: { place: { include: { parent: true } }, source: { select: { title: true, isPublic: true } } } },
      languages: { include: { language: true } },
    },
  });
  if (!community) throw notFound('Communauté introuvable');

  const items = await prisma.culturalItem.findMany({
    where: { ...publicItemWhere, communities: { some: { communityId: community.id } } },
    orderBy: { publishedAt: 'desc' },
    select: publicCardSelect,
  });
  const media = await prisma.mediaAsset.findMany({
    where: { AND: [publicMediaWhere(), { items: { some: { item: { ...publicItemWhere, communities: { some: { communityId: community.id } } } } } }] },
    take: 12,
    orderBy: { createdAt: 'desc' },
    include: { originalFile: { select: { mimeType: true } }, webFile: { select: { mimeType: true } }, place: true },
  });

  res.json({
    cover: await communityCover(community.id),
    community: {
      slug: community.slug,
      name: community.name,
      summary: community.summary,
      description: community.description,
      history: community.history,
      documentationStatus: community.documentationStatus,
      documentationNote: community.documentationNote,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
      names: community.names.map((n) => ({
        name: n.name,
        kind: n.kind,
        notes: n.notes,
        source: n.source?.isPublic ? n.source.title : null,
      })),
      places: community.places.map((p) => ({
        name: p.place.name,
        type: p.place.type,
        parent: p.place.parent?.name ?? null,
        notes: p.notes,
        source: p.source?.isPublic ? p.source.title : null,
      })),
      languages: community.languages.map((l) => ({ name: l.language.name, isoCode: l.language.isoCode, notes: l.notes })),
    },
    items: await toPublicCards(items),
    media: media.map(serializePublicMedia),
  });
});

// Autorités et dynasties d'une communauté (arbre, frise et fiches).
router.get('/communities/:slug/authorities', async (req, res) => {
  const community = await prisma.community.findFirst({ where: { slug: req.params.slug, ...publicCommunityWhere }, select: { id: true } });
  if (!community) throw notFound('Communauté introuvable');
  res.json(await communityAuthorities(community.id));
});

// ----- Réseau du patrimoine ----------------------------------------------

// Liens entre communautés publiées, uniquement à partir de données
// documentées : fiches publiques reliées entre elles, fiches rattachées à
// plusieurs communautés, langues communes et provinces communes (simple
// voisinage géographique). Aucun lien n'est déduit d'autre chose.
router.get('/network', async (req, res) => {
  const [communities, recorded, categories, places, items, relations] = await Promise.all([
    prisma.community.findMany({
      where: publicCommunityWhere,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        documentationStatus: true,
        languages: { select: { language: { select: { id: true, name: true } } } },
        places: { select: { placeId: true } },
      },
    }),
    prisma.community.count(),
    prisma.category.findMany({ select: { id: true, slug: true, name: true, code: true, parentId: true, position: true, isActive: true } }),
    prisma.place.findMany({ select: { id: true, name: true, type: true, parentId: true } }),
    prisma.culturalItem.findMany({
      where: publicItemWhere,
      select: { id: true, slug: true, publishedVersion: { select: { snapshot: true } } },
    }),
    prisma.itemRelation.findMany({
      where: { from: publicItemWhere, to: publicItemWhere },
      select: { fromId: true, toId: true, type: true, notes: true },
    }),
  ]);

  // Domaines : catégories de premier niveau (une sous-catégorie compte pour
  // son domaine parent).
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const domainOf = (id) => {
    let c = categoryById.get(id);
    while (c?.parentId && categoryById.has(c.parentId)) c = categoryById.get(c.parentId);
    return c ?? null;
  };
  const domains = categories
    .filter((c) => !c.parentId && c.isActive)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((c) => ({ slug: c.slug, name: c.name, code: c.code }));

  // Province d'un lieu : lui-même ou son ancêtre de type province.
  const placeById = new Map(places.map((p) => [p.id, p]));
  const provinceOf = (id) => {
    for (let p = placeById.get(id), depth = 0; p && depth < 12; p = placeById.get(p.parentId), depth++) {
      if (p.type === 'PROVINCE') return p.name;
    }
    return null;
  };

  // Fiches publiques, telles que publiées (titre, domaine, communautés).
  const publicIds = new Set(communities.map((c) => c.id));
  const slugById = new Map(communities.map((c) => [c.id, c.slug]));
  const fiches = new Map();
  for (const item of items) {
    const snapshot = JSON.parse(item.publishedVersion?.snapshot ?? '{}');
    const domain = domainOf(snapshot.categoryId);
    fiches.set(item.id, {
      slug: item.slug,
      title: snapshot.title,
      domain: domain?.slug ?? null,
      communities: (snapshot.communityIds ?? []).filter((id) => publicIds.has(id)).map((id) => slugById.get(id)),
    });
  }

  const nodes = communities.map((c) => {
    const own = [...fiches.values()].filter((f) => f.communities.includes(c.slug));
    const counts = {};
    for (const f of own) if (f.domain) counts[f.domain] = (counts[f.domain] ?? 0) + 1;
    return {
      slug: c.slug,
      name: c.name,
      summary: c.summary,
      documentationStatus: c.documentationStatus,
      itemCount: own.length,
      languages: c.languages.map((l) => l.language.name).sort(),
      provinces: [...new Set(c.places.map((p) => provinceOf(p.placeId)).filter(Boolean))].sort(),
      domains: domains.filter((d) => counts[d.slug]).map((d) => ({ slug: d.slug, count: counts[d.slug] })),
    };
  });

  // Une entrée par paire de communautés, avec toutes ses preuves.
  const links = new Map();
  const linkFor = (a, b) => {
    const [source, target] = a < b ? [a, b] : [b, a];
    const key = `${source}|${target}`;
    if (!links.has(key)) links.set(key, { source, target, relations: [], sharedItems: [], languages: [], provinces: [] });
    return links.get(key);
  };
  const card = (f) => ({ slug: f.slug, title: f.title, domain: f.domain });

  for (const f of fiches.values()) {
    for (let i = 0; i < f.communities.length; i++) {
      for (let j = i + 1; j < f.communities.length; j++) linkFor(f.communities[i], f.communities[j]).sharedItems.push(card(f));
    }
  }
  for (const r of relations) {
    const from = fiches.get(r.fromId);
    const to = fiches.get(r.toId);
    if (!from || !to) continue;
    for (const a of from.communities) {
      for (const b of to.communities) {
        if (a === b) continue;
        const link = linkFor(a, b);
        const [first, second] = a === link.source ? [from, to] : [to, from];
        link.relations.push({
          type: r.type,
          notes: r.notes,
          source: { ...card(first), community: link.source, outgoing: first === from },
          target: { ...card(second), community: link.target },
        });
      }
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const languages = a.languages.filter((l) => b.languages.includes(l));
      const provinces = a.provinces.filter((p) => b.provinces.includes(p));
      if (languages.length || provinces.length) Object.assign(linkFor(a.slug, b.slug), { languages, provinces });
    }
  }

  res.json({
    communities: nodes,
    links: [...links.values()],
    domains,
    totals: { published: nodes.length, recorded },
  });
});

// ----- Lieux --------------------------------------------------------------

router.get('/places', async (req, res) => {
  const places = await prisma.place.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      _count: {
        select: {
          communities: { where: { community: publicCommunityWhere } },
          items: { where: { item: publicItemWhere } },
        },
      },
    },
  });
  res.json({
    places: places.map(({ _count, ...p }) => ({ ...p, communityCount: _count.communities, itemCount: _count.items })),
  });
});

// ----- Fiches -------------------------------------------------------------

const itemsQuery = paginationSchema.extend({
  q: z.string().max(200).optional(),
  category: z.string().optional(),
  community: z.string().optional(),
  placeId: z.string().uuid().optional(),
  languageId: z.string().uuid().optional(),
  mediaKind: z.enum(['PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  verification: z.string().optional(),
});

router.get('/items', async (req, res) => {
  const query = parseQuery(itemsQuery, req.query);
  const placeIds = query.placeId ? await placeAndDescendants(query.placeId) : null;
  let categoryIds;
  if (query.category) {
    const all = await prisma.category.findMany({ select: { id: true, slug: true, parentId: true } });
    const root = all.find((c) => c.slug === query.category);
    categoryIds = root ? descendants(all, root.id) : [];
  }
  const where = {
    AND: [
      publicItemWhere,
      ...(query.q ? searchConditions(query.q) : []),
      categoryIds ? { categoryId: { in: categoryIds } } : {},
      query.community ? { communities: { some: { community: { slug: query.community, ...publicCommunityWhere } } } } : {},
      query.placeId
        ? {
            OR: [
              { places: { some: { placeId: { in: placeIds } } } },
              { communities: { some: { community: { places: { some: { placeId: { in: placeIds } } } } } } },
            ],
          }
        : {},
      query.languageId ? { originalLanguageId: query.languageId } : {},
      query.verification ? { verificationStatus: query.verification } : {},
      query.mediaKind ? { media: { some: { media: { AND: [{ kind: query.mediaKind }, publicMediaWhere()] } } } } : {},
    ],
  };
  const [total, items] = await prisma.$transaction([
    prisma.culturalItem.count({ where }),
    prisma.culturalItem.findMany({ where, orderBy: { publishedAt: 'desc' }, ...paginate(query), select: publicCardSelect }),
  ]);
  res.json({ total, page: query.page, pageSize: query.pageSize, items: await toPublicCards(items) });
});

function descendants(categories, rootId) {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const c of categories) if (c.parentId === ids[i]) ids.push(c.id);
  }
  return ids;
}

router.get('/items/:slug', async (req, res) => {
  const item = await prisma.culturalItem.findFirst({
    where: { slug: req.params.slug, ...publicItemWhere },
    include: { publishedVersion: true },
  });
  if (!item) throw notFound('Contenu introuvable');
  res.json({ item: await hydratePublicItem(item) });
});

// ----- Médiathèque --------------------------------------------------------

const mediaQuery = paginationSchema.extend({
  q: z.string().max(200).optional(),
  kind: z.enum(['PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  community: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  added: z.enum(['month', 'year']).optional(),
  sort: z.enum(['recent', 'oldest', 'title']).optional(),
});

// Fiches publiques liées à un média, avec leur catégorie et leurs communautés
// (pour présenter le contexte culturel du média).
const publicMediaItems = (take) => ({
  where: { item: publicItemWhere },
  orderBy: { position: 'asc' },
  take,
  select: {
    caption: true,
    item: {
      select: {
        slug: true,
        title: true,
        category: { select: { slug: true, name: true } },
        communities: { select: { community: { select: { slug: true, name: true } } } },
      },
    },
  },
});

function mediaContext(media) {
  const items = media.items.map(({ item, caption }) => ({
    slug: item.slug,
    title: item.title,
    caption,
    category: item.category,
    communities: item.communities.map((c) => c.community),
  }));
  const unique = (list) => [...new Map(list.map((x) => [x.slug, x])).values()];
  return {
    items: items.map(({ slug, title }) => ({ slug, title })),
    communities: unique(items.flatMap((i) => i.communities)),
    categories: unique(items.map((i) => i.category).filter(Boolean)),
    caption: items.find((i) => i.caption)?.caption ?? null,
  };
}

const mediaListInclude = {
  originalFile: { select: { mimeType: true, sizeBytes: true } },
  webFile: { select: { mimeType: true } },
  place: true,
  items: publicMediaItems(5),
};

function addedSince(added, now = new Date()) {
  if (added === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (added === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

const MEDIA_ORDER = { recent: { createdAt: 'desc' }, oldest: { createdAt: 'asc' }, title: { title: 'asc' } };

router.get('/media', async (req, res) => {
  const query = parseQuery(mediaQuery, req.query);
  const since = addedSince(query.added);
  const itemFilter = {
    ...(query.community && { communities: { some: { community: { slug: query.community } } } }),
    ...(query.category && { category: { slug: query.category } }),
  };
  const where = {
    AND: [
      publicMediaWhere(),
      { kind: query.kind },
      ...(query.q ? [{ OR: [{ title: { contains: query.q } }, { description: { contains: query.q } }, { credit: { contains: query.q } }] }] : []),
      ...(Object.keys(itemFilter).length ? [{ items: { some: { item: { ...publicItemWhere, ...itemFilter } } } }] : []),
      ...(since ? [{ createdAt: { gte: since } }] : []),
    ],
  };
  const [total, media] = await prisma.$transaction([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy: [MEDIA_ORDER[query.sort ?? 'recent'], { id: 'asc' }],
      ...paginate(query),
      include: mediaListInclude,
    }),
  ]);
  res.json({
    total,
    page: query.page,
    pageSize: query.pageSize,
    media: media.map((m) => ({ ...serializePublicMedia(m), ...mediaContext(m) })),
  });
});

// Page de consultation d'un média : média complet (transcriptions publiques
// comprises), contexte culturel et médias associés (même communauté, sinon
// même thème, sinon même type). Un média non public renvoie 404.
router.get('/media/:id', async (req, res) => {
  const media = await prisma.mediaAsset.findFirst({
    where: { AND: [{ id: req.params.id }, publicMediaWhere()] },
    include: {
      ...mediaListInclude,
      items: publicMediaItems(20),
      texts: { where: { isPublic: true }, include: { language: true, revisions: { orderBy: { version: 'desc' }, take: 1 } } },
    },
  });
  if (!media) throw notFound('Média introuvable');
  const context = mediaContext(media);
  const related = [];
  const seen = new Set([media.id]);
  const collect = async (filter, take = 12) => {
    if (related.length >= take) return;
    const found = await prisma.mediaAsset.findMany({
      where: { AND: [publicMediaWhere(), { id: { notIn: [...seen] } }, filter] },
      orderBy: { createdAt: 'desc' },
      take: take - related.length,
      include: mediaListInclude,
    });
    for (const m of found) {
      seen.add(m.id);
      related.push({ ...serializePublicMedia(m), ...mediaContext(m) });
    }
  };
  const slugs = (list) => list.map((x) => x.slug);
  if (context.communities.length) {
    await collect({ items: { some: { item: { ...publicItemWhere, communities: { some: { community: { slug: { in: slugs(context.communities) } } } } } } } });
  }
  if (context.categories.length) {
    await collect({ items: { some: { item: { ...publicItemWhere, category: { slug: { in: slugs(context.categories) } } } } } });
  }
  await collect({ kind: media.kind });
  res.json({ media: { ...serializePublicMedia(media), ...context }, related });
});

// Diffusion d'un fichier public. Les identifiants sont aléatoires et l'accès
// est vérifié à chaque requête : un média restreint renvoie 404 (§17, §47).
// Les requêtes partielles (Range) sont prises en charge par sendFile, ce qui
// permet de se déplacer dans un audio ou une vidéo. `?download=1` n'est
// accepté que si les droits de diffusion du média sont confirmés.
router.get('/media/:id/file', async (req, res) => {
  const media = await prisma.mediaAsset.findFirst({
    where: { AND: [{ id: req.params.id }, publicMediaWhere()] },
    include: { originalFile: true, webFile: true, thumbnailFile: true },
  });
  if (!media) throw notFound('Média introuvable');
  const download = req.query.download === '1' && media.publicationCleared;
  const file =
    media.kind === 'PHOTO' && !download
      ? req.query.variant === 'thumbnail'
        ? media.thumbnailFile ?? media.webFile ?? media.originalFile
        : media.webFile ?? media.originalFile
      : media.originalFile;
  res.setHeader('Content-Type', file.mimeType);
  if (download) res.attachment(file.originalName || media.title);
  else res.setHeader('Content-Disposition', 'inline');
  res.sendFile(resolveKey(file.storageKey));
});

// ----- Recherche générale (§14) -------------------------------------------

router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
  if (!normalizeSearch(q)) return res.json({ q, items: [], communities: [], media: [] });
  const [items, communities, media] = await Promise.all([
    prisma.culturalItem.findMany({
      where: { AND: [publicItemWhere, ...searchConditions(q)] },
      take: 20,
      orderBy: { publishedAt: 'desc' },
      select: publicCardSelect,
    }),
    prisma.community.findMany({
      where: { ...publicCommunityWhere, AND: searchConditions(q) },
      take: 10,
      select: { slug: true, name: true, summary: true, documentationStatus: true },
    }),
    prisma.mediaAsset.findMany({
      where: { AND: [publicMediaWhere(), { title: { contains: q } }] },
      take: 12,
      include: { originalFile: { select: { mimeType: true } }, webFile: { select: { mimeType: true } }, place: true },
    }),
  ]);
  res.json({ q, items: await toPublicCards(items), communities, media: media.map(serializePublicMedia) });
});

router.get('/languages', async (req, res) => {
  const languages = await prisma.language.findMany({
    where: { OR: [{ items: { some: publicItemWhere } }, { communities: { some: { community: publicCommunityWhere } } }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isoCode: true },
  });
  res.json({ languages });
});

router.get('/export', async (req, res) => {
  res.attachment(`urithi-export-public-${new Date().toISOString().slice(0, 10)}.json`);
  res.json(await exportPublic());
});

// ----- Signalements (§48) -------------------------------------------------

const takedownLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Trop de demandes envoyées. Réessayez plus tard.' },
});

const takedownSchema = z.object({
  itemSlug: optionalText(200),
  pageUrl: optionalText(2000),
  requesterName: z.string().trim().min(2).max(200),
  requesterContact: z.string().trim().min(5).max(300),
  requesterRelation: optionalText(500),
  reason: z.enum(['ERROR', 'MISATTRIBUTION', 'CONSENT', 'PRIVACY', 'CULTURAL_RESTRICTION', 'UNAUTHORIZED_USE', 'MISLEADING', 'OTHER']),
  description: z.string().trim().min(10).max(10_000),
});

router.post('/takedown-requests', takedownLimiter, validateBody(takedownSchema), async (req, res) => {
  const { itemSlug, ...data } = req.body;
  const item = itemSlug ? await prisma.culturalItem.findFirst({ where: { slug: itemSlug, ...publicItemWhere }, select: { id: true } }) : null;
  const request = await prisma.takedownRequest.create({ data: { ...data, itemId: item?.id ?? null } });
  await recordAudit({ action: 'TAKEDOWN_RECEIVED', entityType: 'TakedownRequest', entityId: request.id, ip: req.ip });
  res.status(201).json({ id: request.id, message: 'Votre demande a été enregistrée. Elle sera examinée par l’équipe URITHI.' });
});

export default router;
