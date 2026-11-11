import { prisma } from '../db.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { normalizeSearch, parseJson, toJson, uniqueSlug } from '../lib/text.js';
import { canEditItem, canViewItemInternally } from './access.js';
import { recordAudit } from './audit.js';

// Champs de contenu d'une fiche (§19). Ils sont recopiés dans chaque version.
const CONTENT_FIELDS = [
  'title',
  'originalTitle',
  'summary',
  'body',
  'keywords',
  'categoryId',
  'originalLanguageId',
  'dateKind',
  'dateValue',
  'dateEnd',
  'verificationStatus',
  'resourcePersonId',
  'missionId',
];

// Champs structurés écrits par la publication d'un dossier, hors du schéma de
// la catégorie.
const RESERVED_FIELDS = ['authority', 'authorityOverview'];

export const itemInclude = {
  category: true,
  originalLanguage: true,
  communities: { include: { community: { select: { id: true, name: true, slug: true } } } },
  places: { include: { place: true } },
  sources: { include: { source: true } },
  media: {
    include: { media: { include: { consent: { include: { resourcePerson: true } }, originalFile: true } } },
    orderBy: { position: 'asc' },
  },
  consents: { include: { consent: { include: { resourcePerson: true } } } },
  resourcePerson: true,
  accessGrants: true,
  createdBy: { select: { id: true, displayName: true } },
  updatedBy: { select: { id: true, displayName: true } },
};

export function buildSnapshot(item) {
  const snapshot = {};
  for (const field of CONTENT_FIELDS) snapshot[field] = item[field] ?? null;
  snapshot.fields = parseJson(item.fields, {});
  snapshot.communityIds = item.communities.map((c) => c.communityId).sort();
  snapshot.placeIds = item.places.map((p) => p.placeId).sort();
  snapshot.sources = item.sources
    .map((s) => ({ sourceId: s.sourceId, supports: s.supports ?? null, locator: s.locator ?? null }))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  snapshot.media = item.media.map((m) => ({ mediaId: m.mediaId, position: m.position, caption: m.caption ?? null }));
  snapshot.consentIds = item.consents.map((c) => c.consentId).sort();
  return snapshot;
}

export function buildSearchText(snapshot, { categoryName, communityNames = [] }) {
  return normalizeSearch(
    [
      snapshot.title,
      snapshot.originalTitle,
      snapshot.summary,
      snapshot.body,
      snapshot.keywords,
      categoryName,
      ...communityNames,
      ...Object.values(snapshot.fields ?? {}).map((v) => (typeof v === 'string' ? v : JSON.stringify(v))),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function relationWrites(data) {
  const writes = {};
  if (data.communityIds) writes.communities = { create: data.communityIds.map((communityId) => ({ communityId })) };
  if (data.placeIds) writes.places = { create: data.placeIds.map((placeId) => ({ placeId })) };
  if (data.sources) writes.sources = { create: data.sources };
  if (data.media) writes.media = { create: data.media.map((m, i) => ({ ...m, position: m.position ?? i })) };
  if (data.consentIds) writes.consents = { create: data.consentIds.map((consentId) => ({ consentId })) };
  return writes;
}

function scalarWrites(data) {
  const writes = {};
  for (const field of CONTENT_FIELDS) if (data[field] !== undefined) writes[field] = data[field];
  if (data.fields !== undefined) writes.fields = toJson(data.fields);
  if (data.accessLevel !== undefined) writes.accessLevel = data.accessLevel;
  if (data.isSensitive !== undefined) writes.isSensitive = data.isSensitive;
  return writes;
}

async function writeVersion(tx, itemId, version, reason, authorId, publicNote) {
  const item = await tx.culturalItem.findUnique({ where: { id: itemId }, include: itemInclude });
  await tx.itemVersion.create({
    data: { itemId, version, snapshot: JSON.stringify(buildSnapshot(item)), reason, publicNote, authorId },
  });
  return item;
}

export async function loadItemForUser(id, user) {
  const item = await prisma.culturalItem.findUnique({ where: { id }, include: itemInclude });
  if (!item || !canViewItemInternally(user, item, item.accessGrants)) throw notFound('Fiche introuvable');
  return item;
}

export async function createItem(data, user, ip) {
  return prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(tx.culturalItem, data.title);
    const created = await tx.culturalItem.create({
      data: {
        ...scalarWrites(data),
        slug,
        createdById: user.id,
        updatedById: user.id,
        ...relationWrites(data),
      },
    });
    const item = await writeVersion(tx, created.id, 1, 'Création de la fiche', user.id);
    await recordAudit({ actorId: user.id, action: 'ITEM_CREATED', entityType: 'CulturalItem', entityId: item.id, ip }, tx);
    return item;
  });
}

// Toute modification produit une nouvelle version (§44). Une fiche publiée
// passe en révision : le public continue de voir la version publiée tant que
// la nouvelle n'est pas validée.
export async function updateItem(id, data, user, ip) {
  const existing = await loadItemForUser(id, user);
  if (!canEditItem(user, existing)) throw forbidden('Vous ne pouvez pas modifier cette fiche à ce stade');
  if (existing.status === 'ARCHIVED') throw badRequest('Une fiche archivée ne peut pas être modifiée');
  // Données structurées issues d'un dossier (autorités) : l'éditeur de fiches
  // ne les connaît pas, elles sont conservées quand il renvoie les champs.
  if (data.fields) {
    const previous = parseJson(existing.fields, {});
    const kept = Object.fromEntries(RESERVED_FIELDS.filter((k) => previous[k] !== undefined && data.fields[k] === undefined).map((k) => [k, previous[k]]));
    if (Object.keys(kept).length) data = { ...data, fields: { ...data.fields, ...kept } };
  }
  return applyChanges(existing, data, data.reason || 'Modification', user, ip, data.publicNote);
}

async function applyChanges(existing, data, reason, user, ip, publicNote) {
  return prisma.$transaction(async (tx) => {
    const id = existing.id;
    if (data.communityIds) await tx.itemCommunity.deleteMany({ where: { itemId: id } });
    if (data.placeIds) await tx.itemPlace.deleteMany({ where: { itemId: id } });
    if (data.sources) await tx.itemSource.deleteMany({ where: { itemId: id } });
    if (data.media) await tx.itemMedia.deleteMany({ where: { itemId: id } });
    if (data.consentIds) await tx.itemConsent.deleteMany({ where: { itemId: id } });

    const version = existing.currentVersion + 1;
    const goesUnderRevision = existing.status === 'PUBLISHED';
    await tx.culturalItem.update({
      where: { id },
      data: {
        ...scalarWrites(data),
        ...relationWrites(data),
        currentVersion: version,
        updatedById: user.id,
        status: goesUnderRevision ? 'UNDER_REVISION' : undefined,
      },
    });
    if (goesUnderRevision) {
      await tx.validationDecision.create({
        data: {
          itemId: id,
          type: 'TRANSITION',
          fromStatus: 'PUBLISHED',
          toStatus: 'UNDER_REVISION',
          reason: 'Modification d’une fiche publiée',
          version,
          authorId: user.id,
        },
      });
    }
    const item = await writeVersion(tx, id, version, reason, user.id, publicNote);
    await recordAudit(
      { actorId: user.id, action: 'ITEM_UPDATED', entityType: 'CulturalItem', entityId: id, details: { version, reason }, ip },
      tx,
    );
    return item;
  });
}

// Restaurer une version crée une nouvelle version identique : l'historique
// n'est jamais effacé (§44).
export async function restoreVersion(id, versionNumber, user, ip) {
  const existing = await loadItemForUser(id, user);
  if (!canEditItem(user, existing)) throw forbidden();
  const version = await prisma.itemVersion.findUnique({ where: { itemId_version: { itemId: id, version: versionNumber } } });
  if (!version) throw notFound('Version introuvable');
  const snapshot = JSON.parse(version.snapshot);
  const { communityIds, placeIds, sources, media, consentIds, fields, ...scalars } = snapshot;
  return applyChanges(
    existing,
    { ...scalars, fields, communityIds, placeIds, sources, media, consentIds },
    `Restauration de la version ${versionNumber}`,
    user,
    ip,
  );
}

// Conditions de publication (§39, §46). Renvoie la liste des problèmes
// bloquants ; une liste vide autorise la publication.
export function publicationProblems(item, now = new Date()) {
  const problems = [];
  if (item.accessLevel !== 'PUBLIC') problems.push('Le niveau d’accès de la fiche doit être « Public »');
  if (!item.summary?.trim()) problems.push('Le résumé est obligatoire');
  if (item.communities.length === 0) problems.push('Au moins une communauté doit être associée');
  if (!item.category?.isActive) problems.push('La catégorie est désactivée');
  if (['SOURCED', 'CORROBORATED'].includes(item.verificationStatus) && item.sources.length === 0) {
    problems.push('Le statut de vérification « sourcé » ou « corroboré » exige au moins une source');
  }
  // Ni le consentement, ni la personne ressource, ni la source ne
  // conditionnent la publication (décision du porteur du projet) : une fiche
  // sans source ni témoin reste publiable, avec le statut « vérification
  // incomplète » affiché au public.
  return problems;
}

export async function publishInTransaction(tx, item, now = new Date()) {
  const version = await tx.itemVersion.update({
    where: { itemId_version: { itemId: item.id, version: item.currentVersion } },
    data: { publishedAt: now },
  });
  const snapshot = JSON.parse(version.snapshot);
  const communities = await tx.community.findMany({
    where: { id: { in: snapshot.communityIds } },
    include: { names: true },
  });
  const category = await tx.category.findUnique({ where: { id: snapshot.categoryId } });
  return tx.culturalItem.update({
    where: { id: item.id },
    data: {
      status: 'PUBLISHED',
      publishedVersionId: version.id,
      publishedAt: item.publishedAt ?? now,
      scheduledAt: null,
      searchText: buildSearchText(snapshot, {
        categoryName: category?.name,
        communityNames: communities.flatMap((c) => [c.name, ...c.names.map((n) => n.name)]),
      }),
    },
  });
}
