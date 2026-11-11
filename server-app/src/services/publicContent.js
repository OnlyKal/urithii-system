import { prisma } from '../db.js';
import { parseJson } from '../lib/text.js';
import { publicItemWhere, publicMediaWhere } from './access.js';

// Préparation des contenus pour le site public (§16, §17, §45).
// Le public voit uniquement la version publiée, sans données personnelles,
// avec les seuls médias, sources et textes autorisés à la diffusion.

export function publicMediaUrl(media, variant) {
  return `/api/public/media/${media.id}/file${variant ? `?variant=${variant}` : ''}`;
}

export function serializePublicMedia(media) {
  return {
    id: media.id,
    kind: media.kind,
    title: media.title,
    description: media.description,
    credit: media.credit,
    rightsStatement: media.rightsStatement,
    dateKind: media.dateKind,
    dateValue: media.dateValue,
    place: media.place ? { name: media.place.name, type: media.place.type } : null,
    context: media.context,
    provenance: media.provenance ?? null,
    createdAt: media.createdAt,
    sizeBytes: media.originalFile?.sizeBytes ?? null,
    // Téléchargement proposé seulement si les droits de diffusion sont confirmés.
    downloadable: Boolean(media.publicationCleared),
    downloadUrl: media.publicationCleared ? `/api/public/media/${media.id}/file?download=1` : null,
    url: publicMediaUrl(media, media.kind === 'PHOTO' ? 'web' : undefined),
    thumbnailUrl: media.kind === 'PHOTO' ? publicMediaUrl(media, 'thumbnail') : null,
    mimeType: media.kind === 'PHOTO' && media.webFile ? media.webFile.mimeType : media.originalFile?.mimeType,
    texts: (media.texts ?? [])
      .filter((t) => t.isPublic)
      .map((t) => ({
        id: t.id,
        kind: t.kind,
        language: t.language?.name,
        method: t.method,
        verification: t.verification,
        content: t.revisions?.[0]?.content ?? null,
      })),
  };
}

// Attribution du narrateur selon le mode autorisé (§22).
function narrator(person) {
  if (!person) return null;
  if (person.attributionMode === 'NAME') return person.publicName || person.fullName;
  if (person.attributionMode === 'PSEUDONYM') return person.publicName || 'Personne ressource (pseudonyme)';
  return 'Personne ressource anonyme';
}

const publicMediaInclude = {
  originalFile: { select: { mimeType: true } },
  webFile: { select: { mimeType: true } },
  place: true,
  texts: {
    where: { isPublic: true },
    include: { language: true, revisions: { orderBy: { version: 'desc' }, take: 1 } },
  },
};

export async function hydratePublicItem(item) {
  const snapshot = JSON.parse(item.publishedVersion.snapshot);
  const mediaIds = snapshot.media.map((m) => m.mediaId);

  const [category, language, communities, places, sources, media, person, versions, relations] = await Promise.all([
    prisma.category.findUnique({ where: { id: snapshot.categoryId } }),
    snapshot.originalLanguageId ? prisma.language.findUnique({ where: { id: snapshot.originalLanguageId } }) : null,
    prisma.community.findMany({ where: { id: { in: snapshot.communityIds } }, select: { name: true, slug: true, isPublished: true } }),
    prisma.place.findMany({ where: { id: { in: snapshot.placeIds } }, include: { parent: true } }),
    prisma.source.findMany({ where: { id: { in: snapshot.sources.map((s) => s.sourceId) }, isPublic: true } }),
    prisma.mediaAsset.findMany({ where: { AND: [{ id: { in: mediaIds } }, publicMediaWhere()] }, include: publicMediaInclude }),
    snapshot.resourcePersonId ? prisma.resourcePerson.findUnique({ where: { id: snapshot.resourcePersonId } }) : null,
    prisma.itemVersion.findMany({
      where: { itemId: item.id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { version: true, publishedAt: true, publicNote: true },
    }),
    prisma.itemRelation.findMany({
      where: {
        OR: [
          { fromId: item.id, to: publicItemWhere },
          { toId: item.id, from: publicItemWhere },
        ],
      },
      include: { from: { select: { id: true, slug: true, title: true } }, to: { select: { id: true, slug: true, title: true } } },
    }),
  ]);

  const fieldsSchema = parseJson(category?.fieldsSchema, []);
  const sourceLinks = new Map(snapshot.sources.map((s) => [s.sourceId, s]));
  const mediaById = new Map(media.map((m) => [m.id, m]));

  return {
    slug: item.slug,
    title: snapshot.title,
    originalTitle: snapshot.originalTitle,
    summary: snapshot.summary,
    body: snapshot.body,
    keywords: snapshot.keywords,
    category: category && { name: category.name, slug: category.slug },
    fields: fieldsSchema
      .filter((f) => snapshot.fields?.[f.key] !== undefined && snapshot.fields[f.key] !== '' && !(Array.isArray(snapshot.fields[f.key]) && !snapshot.fields[f.key].length))
      .map((f) => ({ key: f.key, label: f.label, type: f.type, value: snapshot.fields[f.key] })),
    originalLanguage: language?.name ?? null,
    date: { kind: snapshot.dateKind, value: snapshot.dateValue, end: snapshot.dateEnd },
    verificationStatus: snapshot.verificationStatus,
    communities: communities.map((c) => ({ name: c.name, slug: c.isPublished ? c.slug : null })),
    places: places.map((p) => ({ name: p.name, type: p.type, parent: p.parent?.name ?? null })),
    sources: sources.map((s) => ({
      type: s.type,
      title: s.title,
      author: s.author,
      date: s.date,
      publisher: s.publisher,
      reference: s.reference,
      url: s.url,
      status: s.status,
      supports: sourceLinks.get(s.id)?.supports ?? null,
      locator: sourceLinks.get(s.id)?.locator ?? null,
    })),
    media: snapshot.media
      .filter((m) => mediaById.has(m.mediaId))
      .map((m) => ({ ...serializePublicMedia(mediaById.get(m.mediaId)), caption: m.caption })),
    // Fiche d'une autorité : l'arbre de sa communauté la présente aussi.
    isAuthority: Boolean(snapshot.fields?.authority),
    privateSourceCount: snapshot.sources.length - sources.length,
    hasConsent: Boolean(person),
    narrator: narrator(person),
    publishedAt: item.publishedAt,
    updatedAt: versions[0]?.publishedAt ?? item.publishedAt,
    history: versions,
    relations: relations.map((r) => {
      const outgoing = r.fromId === item.id;
      const other = outgoing ? r.to : r.from;
      return { type: r.type, direction: outgoing ? 'to' : 'from', slug: other.slug, title: other.title, notes: r.notes };
    }),
  };
}

// Résumé d'une fiche publique pour les listes.
export function publicItemCard(item, { cover = null, communities = [] } = {}) {
  const snapshot = parseJson(item.publishedVersion?.snapshot, {});
  return {
    slug: item.slug,
    title: snapshot.title ?? item.title,
    summary: snapshot.summary ?? null,
    category: item.category ? { name: item.category.name, slug: item.category.slug, code: item.category.code } : null,
    verificationStatus: snapshot.verificationStatus,
    communities,
    cover,
    publishedAt: item.publishedAt,
    updatedAt: item.publishedVersion?.publishedAt ?? item.publishedAt,
  };
}

// Cartes de fiches avec leur photographie de couverture (première photo
// publique de la version publiée) et les noms des communautés, en deux
// requêtes groupées.
export async function toPublicCards(items) {
  const snapshots = new Map(items.map((i) => [i.id, parseJson(i.publishedVersion?.snapshot, {})]));
  const mediaIds = [...new Set([...snapshots.values()].flatMap((s) => (s.media ?? []).map((m) => m.mediaId)))];
  const communityIds = [...new Set([...snapshots.values()].flatMap((s) => s.communityIds ?? []))];
  const [photos, communities] = await Promise.all([
    mediaIds.length
      ? prisma.mediaAsset.findMany({ where: { AND: [{ id: { in: mediaIds } }, { kind: 'PHOTO' }, publicMediaWhere()] }, select: { id: true, title: true } })
      : [],
    communityIds.length
      ? prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true, name: true, slug: true, isPublished: true } })
      : [],
  ]);
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const communityById = new Map(communities.map((c) => [c.id, c]));
  return items.map((item) => {
    const snapshot = snapshots.get(item.id);
    const photo = (snapshot.media ?? []).map((m) => photoById.get(m.mediaId)).find(Boolean);
    return publicItemCard(item, {
      cover: photo ? { url: publicMediaUrl(photo, 'thumbnail'), alt: photo.title } : null,
      communities: (snapshot.communityIds ?? [])
        .map((id) => communityById.get(id))
        .filter(Boolean)
        .map((c) => ({ name: c.name, slug: c.isPublished ? c.slug : null })),
    });
  });
}

// Photographie représentative d'une communauté : première photo publique
// d'un de ses contenus publiés.
export async function communityCover(communityId) {
  const photo = await prisma.mediaAsset.findFirst({
    where: {
      AND: [
        { kind: 'PHOTO' },
        publicMediaWhere(),
        { items: { some: { item: { ...publicItemWhere, communities: { some: { communityId } } } } } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true },
  });
  return photo ? { url: publicMediaUrl(photo, 'web'), thumbnailUrl: publicMediaUrl(photo, 'thumbnail'), alt: photo.title } : null;
}

export const publicCardSelect = {
  id: true,
  slug: true,
  title: true,
  publishedAt: true,
  category: { select: { name: true, slug: true, code: true } },
  publishedVersion: { select: { snapshot: true, publishedAt: true } },
};

// Autorités et dynasties d'une communauté, reconstruites à partir des fiches
// publiques issues des dossiers de collecte (`fields.authority`). Les liens
// pointent vers les fiches publiées : un lien vers une autorité non publiée
// (sensible, retirée…) est simplement ignoré.
export async function communityAuthorities(communityId) {
  const items = await prisma.culturalItem.findMany({
    where: { ...publicItemWhere, communities: { some: { communityId } } },
    select: { slug: true, dossierId: true, publishedVersion: { select: { snapshot: true } } },
  });
  const parsed = items.map((item) => ({ item, snapshot: parseJson(item.publishedVersion?.snapshot, {}) }));
  const rows = parsed.filter((p) => p.snapshot.fields?.authority?.name);
  const overview = parsed.find((p) => p.snapshot.fields?.authorityOverview);
  if (!rows.length) return { overview: null, authorities: [] };

  // Les identifiants des relations sont propres à chaque dossier.
  const key = (row, ref) => `${row.item.dossierId ?? ''}:${ref}`;
  const slugByRef = new Map(rows.map((r) => [key(r, r.snapshot.fields.authority.ref), r.item.slug]));
  const slugOf = (row, ref) => (ref ? slugByRef.get(key(row, ref)) ?? null : null);

  const mediaIds = [...new Set(rows.flatMap((r) => (r.snapshot.media ?? []).map((m) => m.mediaId)))];
  const sourceIds = [...new Set(rows.flatMap((r) => (r.snapshot.sources ?? []).map((s) => s.sourceId)))];
  const [media, sources] = await Promise.all([
    mediaIds.length ? prisma.mediaAsset.findMany({ where: { AND: [{ id: { in: mediaIds } }, publicMediaWhere()] }, select: { id: true, kind: true, title: true } }) : [],
    sourceIds.length ? prisma.source.findMany({ where: { id: { in: sourceIds }, isPublic: true }, select: { id: true, title: true, author: true, date: true, url: true } }) : [],
  ]);
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const authorities = rows.map((row) => {
    const a = row.snapshot.fields.authority;
    return {
      slug: row.item.slug,
      name: a.name,
      title: a.title ?? null,
      type: a.type ?? null,
      lineage: a.lineage ?? null,
      start: a.start ?? null,
      end: a.end ?? null,
      nature: a.nature ?? null,
      verificationStatus: row.snapshot.verificationStatus,
      order: a.order ?? 0,
      predecessor: slugOf(row, a.predecessor),
      parents: (a.parents ?? []).map((ref) => slugOf(row, ref)).filter(Boolean),
      links: (a.links ?? []).map((l) => ({ slug: slugOf(row, l.target), kind: l.kind ?? null })).filter((l) => l.slug),
      events: a.events ?? [],
      otherNames: a.otherNames ?? [],
      biography: a.biography ?? null,
      accession: a.accession ?? null,
      achievements: a.achievements ?? null,
      impact: a.impact ?? null,
      relations: a.relations ?? null,
      legacy: a.legacy ?? null,
      toConfirm: a.toConfirm ?? [],
      media: (row.snapshot.media ?? [])
        .map((m) => ({ ref: mediaById.get(m.mediaId), caption: m.caption ?? null }))
        .filter((m) => m.ref)
        .map(({ ref, caption }) => ({
          id: ref.id,
          kind: ref.kind,
          title: ref.title,
          caption,
          thumbnailUrl: ref.kind === 'PHOTO' ? publicMediaUrl(ref, 'thumbnail') : null,
        })),
      sources: (row.snapshot.sources ?? [])
        .map((s) => sourceById.get(s.sourceId))
        .filter(Boolean)
        .map((s) => ({ title: s.title, author: s.author, date: s.date, url: s.url })),
    };
  });
  const ov = overview?.snapshot.fields.authorityOverview;
  return {
    overview: overview
      ? { slug: overview.item.slug, organisation: ov.organisation ?? null, lineages: ov.lineages ?? [], summary: overview.snapshot.summary ?? null }
      : null,
    authorities,
  };
}
