import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest } from '../lib/errors.js';
import { normalizeSearch, uniqueSlug } from '../lib/text.js';
import { recordAudit } from './audit.js';

// Import de communautés depuis un fichier JSON (voir docs/IMPORT_COMMUNAUTES.md).
// Règles : aucune communauté n'est créée en double (comparaison du nom et des
// autres noms, sans accents ni majuscules) ; une communauté importée n'est
// jamais publiée automatiquement ; une communauté existante est ignorée ou
// complétée, sans qu'aucune information déjà saisie ne soit effacée ; les
// lieux et langues inconnus sont signalés, jamais inventés.

const NAME_KINDS = ['PRIMARY', 'AUTONYM', 'EXONYM', 'HISTORICAL', 'VARIANT'];
const PLACE_TYPES = ['COUNTRY', 'PROVINCE', 'TERRITORY', 'CITY', 'COMMUNE', 'CHIEFDOM', 'LOCALITY', 'VILLAGE', 'OTHER'];
export const MAX_IMPORT = 500;

const text = (max) => z.string().trim().max(max);
const optional = (max) => text(max).optional().nullable();

const nameSchema = z.union([
  text(200).min(1).transform((name) => ({ name, kind: 'VARIANT' })),
  z.object({ name: text(200).min(1), kind: z.enum(NAME_KINDS).default('VARIANT'), notes: optional(1000) }),
]);
const placeSchema = z.union([
  text(200).min(1).transform((name) => ({ name })),
  z.object({ name: text(200).min(1), type: z.enum(PLACE_TYPES).optional(), parent: optional(200), notes: optional(1000) }),
]);
const languageSchema = z.union([
  text(200).min(1).transform((name) => ({ name })),
  z.object({ name: text(200).min(1).optional(), isoCode: optional(10), notes: optional(1000) }).refine((l) => l.name || l.isoCode, 'Nom ou code ISO requis'),
]);

export const communityEntrySchema = z.object({
  name: text(200).min(1, 'Le nom de la communauté est obligatoire'),
  otherNames: z.array(nameSchema).max(100).default([]),
  summary: optional(2000),
  description: optional(100_000),
  history: optional(100_000),
  documentationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'ADVANCED']).optional(),
  documentationNote: optional(2000),
  places: z.array(placeSchema).max(200).default([]),
  languages: z.array(languageSchema).max(100).default([]),
});

// Le fichier peut être un tableau ou un objet { communities: [...] }.
export function readImportFile(data) {
  const list = Array.isArray(data) ? data : data?.communities;
  if (!Array.isArray(list)) throw badRequest('Le fichier doit contenir une liste « communities »');
  if (!list.length) throw badRequest('Le fichier ne contient aucune communauté');
  if (list.length > MAX_IMPORT) throw badRequest(`Au plus ${MAX_IMPORT} communautés par import`);
  return list;
}

const key = (value) => normalizeSearch(value ?? '');

async function loadReferences() {
  const [communities, places, languages] = await Promise.all([
    prisma.community.findMany({ include: { names: true, places: true, languages: true } }),
    prisma.place.findMany({ select: { id: true, name: true, type: true, parentId: true } }),
    prisma.language.findMany({ select: { id: true, name: true, isoCode: true } }),
  ]);
  const byName = new Map();
  for (const c of communities) for (const n of [c.name, ...c.names.map((x) => x.name)]) byName.set(key(n), c);
  return { communities, byName, places, languages };
}

function resolvePlace(ref, places) {
  let candidates = places.filter((p) => key(p.name) === key(ref.name));
  if (ref.type) candidates = candidates.filter((p) => p.type === ref.type);
  if (ref.parent) {
    const parents = new Set(places.filter((p) => key(p.name) === key(ref.parent)).map((p) => p.id));
    candidates = candidates.filter((p) => parents.has(p.parentId));
  }
  if (candidates.length === 1) return { place: candidates[0] };
  return { warning: candidates.length ? `Lieu ambigu : « ${ref.name} » (précisez type ou parent)` : `Lieu inconnu : « ${ref.name} »` };
}

function resolveLanguage(ref, languages) {
  const found =
    (ref.name && languages.find((l) => key(l.name) === key(ref.name))) ||
    (ref.isoCode && languages.find((l) => l.isoCode && key(l.isoCode) === key(ref.isoCode)));
  return found ? { language: found } : { warning: `Langue inconnue : « ${ref.name ?? ref.isoCode} »` };
}

// Analyse le fichier et prépare chaque opération, sans rien écrire.
export async function planImport(list, { mode = 'skip' } = {}) {
  const refs = await loadReferences();
  const seen = new Map();
  const plan = [];
  list.forEach((raw, index) => {
    const parsed = communityEntrySchema.safeParse(raw);
    const label = typeof raw?.name === 'string' ? raw.name : `#${index + 1}`;
    if (!parsed.success) {
      plan.push({ index, name: label, action: 'error', messages: parsed.error.issues.slice(0, 5).map((i) => (i.path.length && i.path[0] !== 'name' ? `${i.path.join('.')} : ${i.message}` : i.message)) });
      return;
    }
    const entry = parsed.data;
    const warnings = [];
    const allNames = [entry.name, ...entry.otherNames.map((n) => n.name)];

    // Doublons à l'intérieur du fichier.
    const dupInFile = allNames.map(key).find((k) => seen.has(k));
    if (dupInFile) {
      plan.push({ index, name: entry.name, action: 'error', messages: [`Doublon dans le fichier avec l’entrée « ${seen.get(dupInFile)} »`] });
      return;
    }
    for (const n of allNames) seen.set(key(n), entry.name);

    const places = [];
    for (const ref of entry.places) {
      const r = resolvePlace(ref, refs.places);
      if (r.place) places.push({ placeId: r.place.id, notes: ref.notes ?? null });
      else warnings.push(r.warning);
    }
    const languages = [];
    for (const ref of entry.languages) {
      const r = resolveLanguage(ref, refs.languages);
      if (r.language) languages.push({ languageId: r.language.id, notes: ref.notes ?? null });
      else warnings.push(r.warning);
    }

    const existing = allNames.map((n) => refs.byName.get(key(n))).find(Boolean);
    if (existing) {
      if (mode !== 'update') {
        plan.push({ index, name: entry.name, action: 'skip', existing: { id: existing.id, name: existing.name }, messages: ['Communauté déjà présente'] });
        return;
      }
      plan.push({ index, name: entry.name, action: 'update', existing: { id: existing.id, name: existing.name }, entry, places, languages, messages: warnings });
      return;
    }
    plan.push({ index, name: entry.name, action: 'create', entry, places, languages, messages: warnings });
  });
  return plan;
}

const dedupeBy = (list, field) => list.filter((x, i) => list.findIndex((y) => y[field] === x[field]) === i);

// Applique un plan préparé par planImport. Chaque communauté est écrite dans
// sa propre transaction : une erreur n'empêche pas les autres.
export async function applyImport(plan, user, ip) {
  const results = [];
  for (const step of plan) {
    if (!['create', 'update'].includes(step.action)) {
      results.push(strip(step));
      continue;
    }
    try {
      const id = await prisma.$transaction(async (tx) => {
        const { entry } = step;
        if (step.action === 'create') {
          const names = dedupeBy(
            [{ name: entry.name, kind: 'PRIMARY', notes: null }, ...entry.otherNames.map((n) => ({ name: n.name, kind: n.kind ?? 'VARIANT', notes: n.notes ?? null }))],
            'name',
          );
          const created = await tx.community.create({
            data: {
              name: entry.name,
              slug: await uniqueSlug(tx.community, entry.name),
              summary: entry.summary || null,
              description: entry.description || null,
              history: entry.history || null,
              documentationStatus: entry.documentationStatus ?? 'NOT_STARTED',
              documentationNote: entry.documentationNote || null,
              isPublished: false,
              searchText: normalizeSearch([entry.name, entry.summary, ...names.map((n) => n.name)].join(' ')),
              names: { create: names },
              places: { create: dedupeBy(step.places, 'placeId') },
              languages: { create: dedupeBy(step.languages, 'languageId') },
            },
          });
          await recordAudit({ actorId: user.id, action: 'COMMUNITY_CREATED', entityType: 'Community', entityId: created.id, details: { import: true }, ip }, tx);
          return created.id;
        }
        // Complément : seuls les champs vides sont remplis ; noms, lieux et
        // langues manquants sont ajoutés, rien n'est retiré.
        const current = await tx.community.findUnique({ where: { id: step.existing.id }, include: { names: true, places: true, languages: true } });
        const fill = (field) => (!current[field] && entry[field] ? entry[field] : undefined);
        const knownNames = new Set([current.name, ...current.names.map((n) => n.name)].map(key));
        const newNames = dedupeBy(
          [entry.name, ...entry.otherNames.map((n) => n.name)]
            .map((name, i) => (i === 0 ? { name, kind: 'VARIANT', notes: null } : { name, kind: entry.otherNames[i - 1].kind ?? 'VARIANT', notes: entry.otherNames[i - 1].notes ?? null }))
            .filter((n) => !knownNames.has(key(n.name))),
          'name',
        );
        const newPlaces = dedupeBy(step.places, 'placeId').filter((p) => !current.places.some((x) => x.placeId === p.placeId));
        const newLanguages = dedupeBy(step.languages, 'languageId').filter((l) => !current.languages.some((x) => x.languageId === l.languageId));
        const allNames = [current.name, ...current.names.map((n) => n.name), ...newNames.map((n) => n.name)];
        await tx.community.update({
          where: { id: current.id },
          data: {
            summary: fill('summary'),
            description: fill('description'),
            history: fill('history'),
            documentationNote: fill('documentationNote'),
            documentationStatus: current.documentationStatus === 'NOT_STARTED' && entry.documentationStatus ? entry.documentationStatus : undefined,
            searchText: normalizeSearch([current.name, current.summary ?? entry.summary, ...allNames].join(' ')),
            names: newNames.length ? { create: newNames } : undefined,
            places: newPlaces.length ? { create: newPlaces } : undefined,
            languages: newLanguages.length ? { create: newLanguages } : undefined,
          },
        });
        await recordAudit({ actorId: user.id, action: 'COMMUNITY_UPDATED', entityType: 'Community', entityId: current.id, details: { import: true }, ip }, tx);
        return current.id;
      });
      results.push({ ...strip(step), communityId: id });
    } catch (err) {
      results.push({ ...strip(step), action: 'error', messages: [...(step.messages ?? []), err.code === 'P2002' ? 'Un élément identique existe déjà' : 'Erreur interne du serveur'] });
    }
  }
  const counts = countActions(results);
  await recordAudit({ actorId: user.id, action: 'COMMUNITIES_IMPORTED', entityType: 'Community', entityId: null, details: counts, ip });
  return results;
}

// Résumé lisible d'une étape de plan (sans les données internes).
function strip(step) {
  return {
    index: step.index,
    name: step.name,
    action: step.action,
    existing: step.existing,
    messages: step.messages ?? [],
    places: step.places?.length ?? 0,
    languages: step.languages?.length ?? 0,
  };
}

export function countActions(list) {
  return list.reduce((acc, s) => ({ ...acc, [s.action]: (acc[s.action] ?? 0) + 1 }), { create: 0, update: 0, skip: 0, error: 0 });
}

export const summarizePlan = (plan) => plan.map(strip);
