import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PERMISSIONS } from '../auth/permissions.js';
import { prisma } from '../db.js';
import { badRequest, forbidden, HttpError, notFound } from '../lib/errors.js';
import { normalizeSearch, parseJson, uniqueSlug } from '../lib/text.js';
import { isSuperAdmin } from './access.js';
import { recordAudit } from './audit.js';
import { findProvince, linkCommunityPlaces, territoriesInText } from './rdcDivisions.js';
import { CONTENT_KINDS, dossierProgress, loadSectionDefs, sectionHasContent } from './dossierSchema.js';
import { createItem, itemInclude, publicationProblems, publishInTransaction, updateItem } from './items.js';

const P = PERMISSIONS;

// Cycle de vie d'un dossier de collecte. « collector » : le collecteur
// propriétaire du dossier (ou l'administrateur) ; « admin » : détenteur de
// dossiers.review. La publication passe par publishDossier.
export const DOSSIER_TRANSITIONS = {
  DRAFT: { SUBMITTED: 'collector', ARCHIVED: 'admin' },
  IN_PROGRESS: { SUBMITTED: 'collector', ARCHIVED: 'admin' },
  CHANGES_REQUESTED: { SUBMITTED: 'collector', ARCHIVED: 'admin' },
  SUBMITTED: { UNDER_REVIEW: 'admin', CHANGES_REQUESTED: 'admin', VALIDATED: 'admin', ARCHIVED: 'admin' },
  UNDER_REVIEW: { CHANGES_REQUESTED: 'admin', VALIDATED: 'admin', ARCHIVED: 'admin' },
  VALIDATED: { UNDER_REVIEW: 'admin', ARCHIVED: 'admin' },
  PUBLISHED: { UNDER_REVIEW: 'admin', CHANGES_REQUESTED: 'admin', ARCHIVED: 'admin' },
  ARCHIVED: { DRAFT: 'admin' },
};
export const DOSSIER_STATUSES = Object.keys(DOSSIER_TRANSITIONS);
export const COLLECTOR_EDITABLE = ['DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED'];
const ADMIN_EDITABLE = ['DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED', 'SUBMITTED', 'UNDER_REVIEW', 'VALIDATED'];
const COMMENT_REQUIRED = ['CHANGES_REQUESTED', 'ARCHIVED'];
const SECTION_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'];

export const canReview = (user) => isSuperAdmin(user) || user.permissions.includes(P.DOSSIERS_REVIEW);
const isOwner = (user, dossier) => dossier.collectorId === user.id;

// ---------------------------------------------------------------------------
// Contenu du dossier
// ---------------------------------------------------------------------------

const text = (max) => z.string().max(max);
// Valeur d'un champ : texte, liste de textes, ou lignes structurées (liens
// et événements des autorités).
const value = z.union([text(100_000), z.array(text(10_000)).max(500), z.array(z.record(text(80), text(10_000))).max(200)]);
const fieldStatus = z.record(text(80), z.enum(['UNKNOWN', 'UNDOCUMENTED', 'TO_CONFIRM']));
const mediaRef = z.object({ mediaId: z.string().uuid(), caption: text(1000).optional() });
const sourceRef = z.object({
  sourceId: z.string().uuid(),
  supports: text(1000).optional(),
  locator: text(300).optional(),
  relation: z.enum(['SUPPORTS', 'CONTRADICTS']).optional(),
});
const entrySchema = z.object({
  id: text(60).min(1),
  values: z.record(text(80), value).default({}),
  fieldStatus: fieldStatus.optional(),
  sensitive: z.boolean().optional(),
  media: z.array(mediaRef).max(200).optional(),
  sources: z.array(sourceRef).max(200).optional(),
});
const sectionSchema = z.object({
  values: z.record(text(80), value).optional(),
  fieldStatus: fieldStatus.optional(),
  entries: z.array(entrySchema).max(300).optional(),
  media: z.array(mediaRef).max(300).optional(),
  sources: z.array(sourceRef).max(300).optional(),
  sensitive: z.boolean().optional(),
  sensitiveNote: text(4000).optional(),
  notDocumented: z.boolean().optional(),
});
export const dossierDataSchema = z.object({ sections: z.record(text(80), sectionSchema).default({}) });

const MAX_DATA_LENGTH = 4_000_000;

// Identifiants référencés par le dossier (médias, sources, personnes,
// consentements), pour vérifier qu'ils existent et sont accessibles.
function collectReferences(defs, data) {
  const refs = { media: new Set(), sources: new Set(), persons: new Set(), consents: new Set() };
  const typed = Object.fromEntries(defs.map((d) => [d.key, Object.fromEntries((d.entry?.fields ?? []).map((field) => [field.key, field.type]))]));
  for (const [key, section] of Object.entries(data.sections)) {
    const items = [section, ...(section.entries ?? [])];
    for (const part of items) {
      for (const m of part.media ?? []) refs.media.add(m.mediaId);
      for (const s of part.sources ?? []) refs.sources.add(s.sourceId);
    }
    for (const entry of section.entries ?? []) {
      for (const [fieldKey, v] of Object.entries(entry.values ?? {})) {
        const type = typed[key]?.[fieldKey];
        if (!v || typeof v !== 'string') continue;
        if (type === 'media') refs.media.add(v);
        if (type === 'person') refs.persons.add(v);
        if (type === 'consent') refs.consents.add(v);
      }
    }
  }
  return refs;
}

// Territoires cochés : uniquement des territoires réels de la province
// choisie. Les anciens textes libres (province ou territoire saisis avant les
// listes) restent acceptés tels quels, pour ne perdre aucune réponse.
function checkAdminDivisions(defs, data) {
  for (const def of defs) {
    const values = data.sections[def.key]?.values;
    if (!values) continue;
    const provinceField = def.fields.find((f) => f.type === 'province');
    const territoriesField = def.fields.find((f) => f.type === 'territories');
    const province = provinceField ? String(values[provinceField.key] ?? '').trim() : '';
    const territories = territoriesField ? values[territoriesField.key] : null;
    if (!Array.isArray(territories) || !territories.some((name) => String(name).trim())) continue;
    if (!findProvince(province)) throw badRequest('Choisissez la province avant ses territoires');
    const allowed = new Set(findProvince(province)?.territories ?? []);
    const wrong = territories.filter((name) => String(name).trim() && !allowed.has(name));
    if (wrong.length) throw badRequest(`Territoire hors de la province choisie : « ${wrong.join(', ')} »`);
  }
}

async function checkReferences(defs, data, user) {
  const refs = collectReferences(defs, data);
  const admin = isSuperAdmin(user);
  const checks = [
    ['media', 'Média introuvable', (ids) =>
      prisma.mediaAsset.count({
        where: { id: { in: ids }, ...(admin ? {} : { OR: [{ createdById: user.id }, { accessLevel: { in: ['PUBLIC', 'CONTRIBUTORS'] } }] }) },
      })],
    ['sources', 'Source introuvable', (ids) => prisma.source.count({ where: { id: { in: ids } } })],
    ['persons', 'Personne introuvable', (ids) => prisma.resourcePerson.count({ where: { id: { in: ids } } })],
    ['consents', 'Consentement introuvable', (ids) => prisma.consent.count({ where: { id: { in: ids } } })],
  ];
  for (const [kind, message, count] of checks) {
    const ids = [...refs[kind]];
    if (ids.length && (await count(ids)) !== ids.length) throw badRequest(message);
  }
}

export async function parseDossierData(input, user) {
  const parsed = dossierDataSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.issues.slice(0, 10).map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  if (JSON.stringify(parsed.data).length > MAX_DATA_LENGTH) throw badRequest('Données invalides');
  const defs = await loadSectionDefs(prisma);
  const known = new Set(defs.map((d) => d.key));
  for (const key of Object.keys(parsed.data.sections)) if (!known.has(key)) throw badRequest('Données invalides');
  checkAdminDivisions(defs, parsed.data);
  await checkReferences(defs, parsed.data, user);
  return { data: parsed.data, defs };
}

export const sectionHash = (section) => createHash('sha1').update(JSON.stringify(section ?? {})).digest('hex');

export function serializeDossier(dossier) {
  return {
    ...dossier,
    data: parseJson(dossier.data, { sections: {} }),
    reviews: parseJson(dossier.reviews, {}),
    publication: parseJson(dossier.publication, {}),
  };
}

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

export const dossierInclude = {
  community: { select: { id: true, name: true, slug: true, isPublished: true } },
  collector: { select: { id: true, displayName: true, email: true } },
  mission: { select: { id: true, code: true, title: true } },
};

export async function loadDossier(id, user) {
  const dossier = await prisma.collectionDossier.findUnique({ where: { id }, include: dossierInclude });
  if (!dossier || (!canReview(user) && !isOwner(user, dossier))) throw notFound('Dossier introuvable');
  return dossier;
}

export function canEditDossier(user, dossier) {
  if (canReview(user)) return ADMIN_EDITABLE.includes(dossier.status);
  return isOwner(user, dossier) && COLLECTOR_EDITABLE.includes(dossier.status);
}

export function allowedDossierTransitions(user, dossier) {
  return Object.entries(DOSSIER_TRANSITIONS[dossier.status] ?? {})
    .filter(([, who]) => (who === 'admin' ? canReview(user) : canReview(user) || isOwner(user, dossier)))
    .map(([status]) => ({ status, commentRequired: COMMENT_REQUIRED.includes(status) }));
}

export function addEvent(tx, dossier, user, event) {
  return tx.dossierEvent.create({ data: { dossierId: dossier.id, version: dossier.version, authorId: user.id, ...event } });
}

async function snapshot(tx, dossier, user, reason) {
  const version = dossier.version + 1;
  await tx.dossierVersion.create({ data: { dossierId: dossier.id, version, data: dossier.data, reason, authorId: user.id } });
  return version;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export async function transitionDossier(id, { toStatus, comment }, user, ip) {
  const dossier = await loadDossier(id, user);
  const allowed = allowedDossierTransitions(user, dossier).find((t) => t.status === toStatus);
  if (!allowed) {
    if (DOSSIER_TRANSITIONS[dossier.status]?.[toStatus]) throw forbidden('Vous n’avez pas la permission pour cette étape');
    throw badRequest(`Transition impossible de « ${dossier.status} » vers « ${toStatus} »`);
  }
  if (allowed.commentRequired && !comment?.trim()) throw badRequest('Un motif est obligatoire pour cette étape');

  const defs = await loadSectionDefs(prisma);
  const data = parseJson(dossier.data, { sections: {} });
  let reviews = parseJson(dossier.reviews, {});

  if (toStatus === 'SUBMITTED') {
    if (!dossier.communityId && !dossier.proposedCommunityName) throw badRequest('Choisissez ou proposez une communauté');
    const withContent = defs.filter((d) => CONTENT_KINDS.includes(d.kind) || d.kind === 'testimonies').filter((d) => sectionHasContent(d, data.sections[d.key]));
    if (!withContent.length) throw badRequest('Le dossier ne contient encore aucune information');
    for (const def of defs) {
      for (const entry of data.sections[def.key]?.entries ?? []) {
        const titleField = def.entry?.titleField;
        if (titleField && !String(entry.values?.[titleField] ?? '').trim()) {
          throw badRequest(`Chaque élément de « ${def.title} » doit avoir un nom`);
        }
      }
    }
    // Une étape corrigée, ou modifiée depuis son approbation, est à revoir.
    for (const [key, review] of Object.entries(reviews)) {
      if (review.status === 'CHANGES_REQUESTED' || (review.status === 'APPROVED' && review.hash !== sectionHash(data.sections[key]))) {
        reviews[key] = { ...review, status: 'PENDING', previousStatus: review.status };
      }
    }
  }
  if (toStatus === 'VALIDATED') {
    if (!dossier.communityId) throw badRequest('Créez ou associez la communauté avant de valider le dossier');
    const blocking = Object.entries(reviews).filter(([, r]) => r.status === 'CHANGES_REQUESTED');
    if (blocking.length) throw badRequest('Des corrections sont encore demandées sur certaines étapes');
    // Les étapes renseignées et non examinées sont approuvées avec le dossier.
    for (const def of defs) {
      if (!sectionHasContent(def, data.sections[def.key])) continue;
      const review = reviews[def.key];
      if (!review || review.status === 'PENDING') {
        reviews[def.key] = { status: 'APPROVED', reviewerId: user.id, reviewerName: user.displayName, at: new Date().toISOString(), hash: sectionHash(data.sections[def.key]) };
      }
    }
  }

  const snapshotReasons = { SUBMITTED: 'Soumission', CHANGES_REQUESTED: 'Corrections demandées', VALIDATED: 'Validation' };
  return prisma.$transaction(async (tx) => {
    const version = snapshotReasons[toStatus] ? await snapshot(tx, dossier, user, snapshotReasons[toStatus]) : dossier.version;
    const now = new Date();
    const updated = await tx.collectionDossier.update({
      where: { id: dossier.id },
      data: {
        status: toStatus,
        version,
        reviews: JSON.stringify(reviews),
        submittedAt: toStatus === 'SUBMITTED' ? now : undefined,
        validatedAt: toStatus === 'VALIDATED' ? now : undefined,
      },
    });
    await addEvent(tx, updated, user, { type: 'TRANSITION', fromStatus: dossier.status, toStatus, comment: comment?.trim() || null });
    await recordAudit(
      { actorId: user.id, action: 'DOSSIER_STATUS_CHANGED', entityType: 'CollectionDossier', entityId: dossier.id, details: { from: dossier.status, to: toStatus }, ip },
      tx,
    );
    return updated;
  });
}

export async function reviewSection(id, sectionKey, { status, comment }, user, ip) {
  if (!canReview(user)) throw forbidden();
  if (!SECTION_REVIEW_STATUSES.includes(status)) throw badRequest('Données invalides');
  if (['CHANGES_REQUESTED', 'REJECTED'].includes(status) && !comment?.trim()) throw badRequest('Un motif est obligatoire pour cette étape');
  const dossier = await loadDossier(id, user);
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(dossier.status)) throw badRequest('Le dossier n’est pas en cours de vérification');
  const defs = await loadSectionDefs(prisma);
  if (!defs.some((d) => d.key === sectionKey)) throw notFound('Étape introuvable');
  const data = parseJson(dossier.data, { sections: {} });
  const reviews = parseJson(dossier.reviews, {});
  reviews[sectionKey] = {
    status,
    comment: comment?.trim() || null,
    reviewerId: user.id,
    reviewerName: user.displayName,
    at: new Date().toISOString(),
    hash: sectionHash(data.sections[sectionKey]),
  };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.collectionDossier.update({
      where: { id: dossier.id },
      // Examiner une étape ouvre la vérification du dossier.
      data: { reviews: JSON.stringify(reviews), status: 'UNDER_REVIEW' },
    });
    if (dossier.status === 'SUBMITTED') await addEvent(tx, updated, user, { type: 'TRANSITION', fromStatus: 'SUBMITTED', toStatus: 'UNDER_REVIEW' });
    await addEvent(tx, updated, user, { type: 'SECTION_REVIEW', sectionKey, comment: `${status}${comment?.trim() ? ` : ${comment.trim()}` : ''}` });
    await recordAudit(
      { actorId: user.id, action: 'DOSSIER_SECTION_REVIEWED', entityType: 'CollectionDossier', entityId: dossier.id, details: { sectionKey, status }, ip },
      tx,
    );
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Communauté proposée
// ---------------------------------------------------------------------------

// Communautés existantes dont le nom (ou un autre nom) correspond.
export async function findSimilarCommunities(name) {
  const wanted = normalizeSearch(name);
  if (!wanted) return [];
  const communities = await prisma.community.findMany({ include: { names: true }, orderBy: { name: 'asc' } });
  return communities.filter((c) => [c.name, ...c.names.map((n) => n.name)].some((n) => normalizeSearch(n) === wanted));
}

export async function resolveCommunity(id, { communityId }, user, ip) {
  if (!canReview(user)) throw forbidden();
  const dossier = await loadDossier(id, user);
  if (['PUBLISHED', 'ARCHIVED'].includes(dossier.status)) throw badRequest('Données invalides');
  let community;
  if (communityId) {
    community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw notFound('Communauté introuvable');
  } else {
    const name = dossier.proposedCommunityName?.trim();
    if (!name) throw badRequest('Choisissez ou proposez une communauté');
    const similar = await findSimilarCommunities(name);
    if (similar.length) throw new HttpError(409, 'Un élément identique existe déjà', similar.map((c) => ({ message: c.name, field: c.id })));
    community = await prisma.community.create({
      data: {
        name,
        slug: await uniqueSlug(prisma.community, name),
        searchText: normalizeSearch(name),
        documentationStatus: 'IN_PROGRESS',
        names: { create: [{ name, kind: 'PRIMARY' }] },
      },
    });
    await recordAudit({ actorId: user.id, action: 'COMMUNITY_CREATED', entityType: 'Community', entityId: community.id, details: { fromDossier: dossier.id }, ip });
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.collectionDossier.update({ where: { id: dossier.id }, data: { communityId: community.id } });
    await addEvent(tx, updated, user, { type: communityId ? 'COMMUNITY_LINKED' : 'COMMUNITY_CREATED', comment: community.name });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Publication : chaque étape approuvée devient une fiche culturelle, et chaque
// élément répété (plat, danse, lieu…) une fiche à part. Les fiches suivent
// les règles habituelles : conditions de publication, versions, audit.
// ---------------------------------------------------------------------------

const isFilled = (v) => (Array.isArray(v) ? v.some((x) => String(x).trim()) : Boolean(String(v ?? '').trim()));
const STATUS_NOTES = { TO_CONFIRM: ' (à confirmer)' };
const BODY_TYPES = ['text', 'longtext', 'list', 'select', 'date', 'province', 'territories'];

function renderFields(fields, values = {}, status = {}, skip = new Set()) {
  const parts = [];
  for (const field of fields) {
    if (skip.has(field.key) || !BODY_TYPES.includes(field.type)) continue;
    const v = values[field.key];
    if (!isFilled(v)) continue;
    const content = Array.isArray(v) ? v.filter((x) => String(x).trim()).map((x) => `- ${x.trim()}`).join('\n') : String(v).trim();
    parts.push(`## ${field.label}${STATUS_NOTES[status[field.key]] ?? ''}\n\n${content}`);
  }
  return parts.join('\n\n');
}

// Résumé d'une fiche : premier texte descriptif (texte long, puis texte
// court, puis liste) ; jamais un simple choix dans une liste (type…).
function summaryFrom(fields, values = {}, skip = new Set()) {
  for (const type of ['longtext', 'text', 'list']) {
    for (const field of fields) {
      if (skip.has(field.key) || field.type !== type) continue;
      const v = values[field.key];
      if (!isFilled(v)) continue;
      return truncate(Array.isArray(v) ? v.filter((x) => String(x).trim()).join(', ') : String(v));
    }
  }
  return null;
}

function truncate(value, max = 280) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(' ', max) > 0 ? clean.lastIndexOf(' ', max) : max)}…`;
}

// Nature de l'information d'un élément, quand l'étape la précise : un récit
// traditionnel, une hypothèse ou une information à confirmer ne sont jamais
// présentés comme des faits établis.
const NATURE_STATUS = { 'Récit traditionnel': 'ORAL_TRADITION', 'Tradition orale': 'ORAL_TRADITION', Hypothèse: 'HYPOTHESIS', 'À confirmer': 'INCOMPLETE' };
// Formes de littérature orale (étape « Langue et expressions orales »).
const ORAL_TYPES = ['Proverbe', 'Dicton', 'Devinette', 'Conte', 'Légende', 'Récit', 'Chant'];
// Éléments du patrimoine matériel publiés dans « Patrimoine matériel et
// archives » (code O) plutôt que dans la catégorie de l'étape.
const MATERIAL_TYPES = ['Monument', 'Objet', 'Lieu de mémoire', 'Site historique'];

function entryVerification(entry, sources, witnesses) {
  const nature = NATURE_STATUS[entry.values?.nature];
  if (nature) return nature;
  if (ORAL_TYPES.includes(entry.values?.type)) return 'ORAL_TRADITION';
  // Un témoignage recueilli auprès d'un témoin, sans autre source écrite.
  return sources.length ? 'SOURCED' : witnesses.length ? 'TESTIMONY' : 'INCOMPLETE';
}

// --- Autorités et dynasties ------------------------------------------------
// Chaque autorité devient une fiche ; ses données structurées sont gardées
// dans `fields.authority` de la fiche, et l'arbre public est reconstruit à
// partir des seules fiches publiées (voir routes/public.js).

const clean = (v) => String(v ?? '').trim();
const cleanList = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);

export function authorityData(entry, index) {
  const v = entry.values ?? {};
  const rows = (list) => (Array.isArray(list) ? list.filter((r) => r && typeof r === 'object') : []);
  const status = entry.fieldStatus ?? {};
  return {
    ref: entry.id,
    order: index,
    name: clean(v.nom),
    title: clean(v.titre) || null,
    type: clean(v.type) || null,
    lineage: clean(v.lignee) || null,
    start: clean(v.debut) || null,
    end: clean(v.fin) || null,
    nature: clean(v.nature) || null,
    predecessor: clean(v.predecesseur) || null,
    parents: cleanList(v.parents),
    links: rows(v.liens).map((l) => ({ target: clean(l.target), kind: clean(l.kind) || null })).filter((l) => l.target),
    events: rows(v.evenements)
      .map((e) => ({ title: clean(e.title), date: clean(e.date) || null, type: clean(e.type) || null, nature: clean(e.nature) || null, description: clean(e.description) || null }))
      .filter((e) => e.title),
    otherNames: cleanList(v.autresNoms),
    biography: clean(v.biographie) || null,
    accession: clean(v.accession) || null,
    achievements: clean(v.realisations) || null,
    impact: clean(v.impact) || null,
    relations: clean(v.relationsExterieures) || null,
    legacy: clean(v.heritage) || null,
    toConfirm: Object.entries(status).filter(([, s]) => s === 'TO_CONFIRM').map(([k]) => k),
  };
}

// Texte lisible de la fiche d'une autorité : champs simples, puis relations
// et événements (les noms des autres autorités sont repris du dossier).
function authorityBody(def, entry, entries, skip) {
  const byId = new Map(entries.map((e) => [e.id, clean(e.values?.[def.entry.titleField])]));
  const nameOf = (id) => byId.get(id) || null;
  const data = authorityData(entry, 0);
  const parts = [renderFields(def.entry.fields, entry.values, entry.fieldStatus, skip)];
  const links = [];
  if (nameOf(data.predecessor)) links.push(`- Prédécesseur : ${nameOf(data.predecessor)}`);
  const successors = entries.filter((e) => clean(e.values?.predecesseur) === entry.id).map((e) => nameOf(e.id)).filter(Boolean);
  if (successors.length) links.push(`- Successeur : ${successors.join(', ')}`);
  const parents = data.parents.map(nameOf).filter(Boolean);
  if (parents.length) links.push(`- Parents : ${parents.join(', ')}`);
  for (const l of data.links) if (nameOf(l.target)) links.push(`- ${l.kind ?? 'Lien'} : ${nameOf(l.target)}`);
  if (links.length) parts.push(`## Liens avec d’autres autorités\n\n${links.join('\n')}`);
  if (data.events.length) {
    const lines = data.events.map((e) => {
      const head = [e.date, e.type].filter(Boolean).join(' · ');
      const nature = e.nature && e.nature !== 'Fait vérifié' ? ` (${e.nature.toLowerCase()})` : '';
      return `- ${head ? `${head} — ` : ''}${e.title}${nature}${e.description ? ` : ${e.description}` : ''}`;
    });
    parts.push(`## Événements marquants\n\n${lines.join('\n')}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

// Résumé : biographie, sinon fonction, titre et période.
function authoritySummary(data) {
  if (data.biography) return truncate(data.biography);
  const period = [data.start, data.end].filter(Boolean).join(' – ');
  const line = [data.type, data.title, data.lineage, period].filter(Boolean).join(' · ');
  return line || null;
}

function authorityDates(data) {
  if (data.start && data.end) return { dateKind: 'PERIOD', dateValue: data.start, dateEnd: data.end };
  if (data.start || data.end) return { dateKind: 'APPROXIMATE', dateValue: data.start || data.end, dateEnd: null };
  return {};
}

// Fiches à créer pour un dossier validé.
export async function buildPublicationUnits(dossier, defs, data, reviews, community) {
  const testimonies = defs.find((d) => d.kind === 'testimonies');
  const testimonyEntries = testimonies ? data.sections[testimonies.key]?.entries ?? [] : [];
  const categories = await prisma.category.findMany({ where: { OR: [{ id: { in: defs.map((d) => d.categoryId).filter(Boolean) } }, { code: 'O', parentId: null }] } });
  const materialCategory = categories.find((c) => c.code === 'O' && !c.parentId);

  const units = [];
  for (const def of defs) {
    if (!CONTENT_KINDS.includes(def.kind)) continue;
    const section = data.sections[def.key];
    if (!section || !sectionHasContent(def, section)) continue;
    // Une étape désactivée qui contient des informations est signalée.
    if (!def.isActive) {
      units.push({ key: def.key, title: def.title, skipped: 'INACTIVE' });
      continue;
    }
    const review = reviews[def.key];
    if (review?.status === 'REJECTED') {
      units.push({ key: def.key, title: def.title, skipped: 'REJECTED' });
      continue;
    }
    if (!def.categoryId) {
      units.push({ key: def.key, title: def.title, skipped: 'NO_CATEGORY' });
      continue;
    }
    const category = categories.find((c) => c.id === def.categoryId);
    // Témoins des témoignages rattachés à cette étape (les consentements ne
    // sont plus utilisés : décision du porteur du projet).
    const witnesses = [...new Set(testimonyEntries.filter((e) => (e.values?.sections ?? []).includes(def.key) && e.values?.temoin).map((e) => e.values.temoin))];
    const common = {
      categoryId: def.categoryId,
      communityIds: [community.id],
      consentIds: [],
      resourcePersonId: witnesses[0] ?? null,
      missionId: dossier.missionId ?? null,
    };
    const verification = (sources) => (sources.length ? 'SOURCED' : witnesses.length ? 'TESTIMONY' : 'INCOMPLETE');
    const refs = (part) => ({
      sources: (part.sources ?? [])
        .filter((s) => s.relation !== 'CONTRADICTS')
        .map((s) => ({ sourceId: s.sourceId, supports: s.supports || null, locator: s.locator || null })),
      media: (part.media ?? []).map((m, position) => ({ mediaId: m.mediaId, caption: m.caption || null, position })),
    });

    if (Object.values(section.values ?? {}).some(isFilled)) {
      const { sources, media } = refs(section);
      const body = renderFields(def.fields, section.values, section.fieldStatus);
      units.push({
        key: def.key,
        title: `${def.title} — ${community.name}`,
        sensitive: Boolean(section.sensitive),
        item: {
          ...common,
          title: `${def.title} — ${community.name}`,
          summary: summaryFrom(def.fields, section.values) ?? `${def.title} — ${community.name}`,
          body,
          sources: dedupe(sources, 'sourceId'),
          media: dedupe(media, 'mediaId'),
          fields:
            def.kind === 'authorities'
              ? { authorityOverview: { organisation: clean(section.values?.organisation) || null, lineages: cleanList(section.values?.lignees) } }
              : {},
          verificationStatus: verification(sources),
        },
      });
    }
    for (const [index, entry] of (section.entries ?? []).entries()) {
      if (!def.entry) break;
      const titleField = def.entry.titleField;
      const title = String(entry.values?.[titleField] ?? '').trim();
      if (!title) continue;
      // Catégorie de l'élément : celle de l'étape, sauf patrimoine matériel.
      const entryCategory = MATERIAL_TYPES.includes(entry.values?.type) && materialCategory ? materialCategory : category;
      const entryFields = parseJson(entryCategory?.fieldsSchema, []).map((cf) => cf.key);
      const skip = new Set([titleField, ...entryFields]);
      const fields = Object.fromEntries(entryFields.filter((k) => isFilled(entry.values?.[k])).map((k) => [k, entry.values[k]]));
      const { sources, media } = refs(entry);
      const isAuthority = def.kind === 'authorities';
      const body = isAuthority ? authorityBody(def, entry, section.entries, skip) : renderFields(def.entry.fields, entry.values, entry.fieldStatus, skip);
      const authority = isAuthority ? authorityData(entry, index) : null;
      if (authority) fields.authority = authority;
      const localName = entry.values?.nomLocal || (Array.isArray(entry.values?.localNames) ? entry.values.localNames[0] : null);
      units.push({
        key: `${def.key}:${entry.id}`,
        title,
        sensitive: Boolean(section.sensitive || entry.sensitive),
        item: {
          ...common,
          title,
          originalTitle: localName || null,
          ...(authority ? authorityDates(authority) : {}),
          summary: (isAuthority ? authoritySummary(authority) : null) ?? summaryFrom(def.entry.fields, entry.values, new Set([titleField])) ?? title,
          body: body || null,
          sources: dedupe(sources, 'sourceId'),
          media: dedupe(media, 'mediaId'),
          fields,
          categoryId: entryCategory?.id ?? def.categoryId,
          verificationStatus: entryVerification(entry, sources, witnesses),
        },
      });
    }
  }
  return units;
}

const dedupe = (list, key) => list.filter((x, i) => list.findIndex((y) => y[key] === x[key]) === i);

export async function publishDossier(id, options, user, ip) {
  if (!canReview(user)) throw forbidden();
  const dossier = await loadDossier(id, user);
  if (dossier.status !== 'VALIDATED') throw badRequest('Seul un dossier validé peut être publié');
  if (!dossier.communityId) throw badRequest('Créez ou associez la communauté avant de valider le dossier');
  const defs = await loadSectionDefs(prisma);
  const data = parseJson(dossier.data, { sections: {} });
  const reviews = parseJson(dossier.reviews, {});
  const publication = parseJson(dossier.publication, {});
  const community = await prisma.community.findUnique({ where: { id: dossier.communityId }, include: { names: true } });
  const units = await buildPublicationUnits(dossier, defs, data, reviews, community);
  const report = { published: [], pending: [], sensitive: [], skipped: [] };

  for (const unit of units) {
    if (unit.skipped) {
      report.skipped.push({ key: unit.key, title: unit.title, reason: unit.skipped });
      continue;
    }
    const payload = {
      ...unit.item,
      accessLevel: unit.sensitive ? 'TEAM' : 'PUBLIC',
      isSensitive: unit.sensitive,
      reason: `Dossier de collecte (version ${dossier.version})`,
    };
    const existingId = publication[unit.key];
    const existing = existingId ? await prisma.culturalItem.findUnique({ where: { id: existingId } }) : null;
    let item;
    if (existing && existing.status !== 'ARCHIVED') {
      item = await updateItem(existing.id, payload, user, ip);
    } else {
      item = await createItem(payload, user, ip);
      // La fiche est attribuée au collecteur ; le dossier garde la trace de sa provenance.
      await prisma.culturalItem.update({ where: { id: item.id }, data: { createdById: dossier.collectorId, dossierId: dossier.id, dossierUnit: unit.key } });
      publication[unit.key] = item.id;
    }
    const fresh = await prisma.culturalItem.findUnique({ where: { id: item.id }, include: itemInclude });
    const problems = unit.sensitive ? [] : publicationProblems(fresh);
    await prisma.$transaction(async (tx) => {
      if (fresh.status !== 'VALIDATED') {
        await tx.culturalItem.update({ where: { id: fresh.id }, data: { status: 'VALIDATED', updatedById: user.id } });
        await tx.validationDecision.create({
          data: {
            itemId: fresh.id,
            type: 'APPROVE',
            fromStatus: fresh.status,
            toStatus: 'VALIDATED',
            reason: 'Validé dans le dossier de collecte',
            comments: `Dossier ${dossier.id}`,
            version: fresh.currentVersion,
            authorId: user.id,
          },
        });
      }
      if (!unit.sensitive && !problems.length) {
        await publishInTransaction(tx, { ...fresh, status: 'VALIDATED' });
        await tx.validationDecision.create({
          data: { itemId: fresh.id, type: 'TRANSITION', fromStatus: 'VALIDATED', toStatus: 'PUBLISHED', version: fresh.currentVersion, authorId: user.id },
        });
        await recordAudit({ actorId: user.id, action: 'ITEM_PUBLISHED', entityType: 'CulturalItem', entityId: fresh.id, details: { dossier: dossier.id }, ip }, tx);
      }
    });
    const line = { key: unit.key, title: unit.title, itemId: fresh.id };
    if (unit.sensitive) report.sensitive.push(line);
    else if (problems.length) report.pending.push({ ...line, problems });
    else report.published.push(line);
  }

  // Présentation de la communauté, si demandé.
  if (options.updateCommunity) await updateCommunityFromDossier(community, defs, data);
  if (options.publishCommunity && report.published.length && !community.isPublished) {
    await prisma.community.update({ where: { id: community.id }, data: { isPublished: true } });
  }
  // Des contenus sont désormais publiés : la documentation a commencé.
  if (report.published.length && community.documentationStatus === 'NOT_STARTED') {
    await prisma.community.update({ where: { id: community.id }, data: { documentationStatus: 'PARTIAL' } });
  }

  return prisma.$transaction(async (tx) => {
    const version = await snapshot(tx, dossier, user, 'Publication');
    const updated = await tx.collectionDossier.update({
      where: { id: dossier.id },
      data: { status: 'PUBLISHED', version, publishedAt: new Date(), publication: JSON.stringify(publication) },
    });
    await addEvent(tx, updated, user, {
      type: 'TRANSITION',
      fromStatus: 'VALIDATED',
      toStatus: 'PUBLISHED',
      comment: `${report.published.length} publiée(s), ${report.pending.length} en attente, ${report.sensitive.length} sensible(s)`,
    });
    await recordAudit({ actorId: user.id, action: 'DOSSIER_PUBLISHED', entityType: 'CollectionDossier', entityId: dossier.id, details: { counts: Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.length])) }, ip }, tx);
    return { dossier: updated, report };
  });
}

// Reprend la présentation (étape 1) et l'histoire (étape 2) dans la fiche de
// la communauté, ajoute les autres noms qui n'y figurent pas encore et la
// rattache à sa province et à ses territoires (carte de l'accueil).
async function updateCommunityFromDossier(community, defs, data) {
  const identification = data.sections.identification?.values ?? {};
  // Province et territoires cochés : la communauté apparaît sur la carte.
  await linkCommunityPlaces(
    prisma,
    community.id,
    identification.province,
    Array.isArray(identification.territoire) ? identification.territoire : territoriesInText(identification.province, identification.territoire),
  );
  const histoire = data.sections.histoire?.values ?? {};
  const presentation = String(identification.presentation ?? '').trim();
  const history = ['origines', 'recitsFondateurs', 'migrations', 'evolution']
    .map((k) => String(histoire[k] ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
  const known = new Set([community.name, ...community.names.map((n) => n.name)].map(normalizeSearch));
  const newNames = (Array.isArray(identification.autresNoms) ? identification.autresNoms : [])
    .map((n) => n.trim())
    .filter((n) => n && !known.has(normalizeSearch(n)));
  await prisma.community.update({
    where: { id: community.id },
    data: {
      summary: presentation ? truncate(presentation) : undefined,
      description: presentation || undefined,
      history: history || undefined,
      names: newNames.length ? { create: newNames.map((name) => ({ name, kind: 'VARIANT' })) } : undefined,
      searchText: normalizeSearch([community.name, ...community.names.map((n) => n.name), ...newNames, presentation].join(' ')),
    },
  });
}

export { dossierProgress };
