import { readFileSync } from 'node:fs';
import { normalizeSearch } from '../lib/text.js';

// Provinces et territoires de la RDC (voir data/rdcDivisions.json, copie
// identique de web-app/src/data/rdcDivisions.json, vérifiée par les tests).
export const RDC_DIVISIONS = JSON.parse(readFileSync(new URL('../data/rdcDivisions.json', import.meta.url), 'utf8'));

const byName = new Map(RDC_DIVISIONS.provinces.map((p) => [normalizeSearch(p.name), p]));

// Territoires des provinces choisies cités dans un ancien texte libre
// (« Kalehe et l’île d’Idjwi » → Kalehe, Idjwi).
export function territoriesInText(provinceValue, text) {
  const words = (value) => ` ${normalizeSearch(String(value ?? '')).replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const haystack = words(text);
  return provincesOf(provinceValue).flatMap((p) => p.territories).filter((name) => haystack.includes(words(name)));
}

// Province à partir de son nom, sans tenir compte des accents, de la casse,
// ni des tirets (« Kongo Central » = « Kongo-Central »).
export function findProvince(name) {
  return byName.get(normalizeSearch(String(name ?? ''))) ?? null;
}

// Provinces reconnues d'un champ « province » : un nom (une seule province,
// forme historique) ou une liste de noms (plusieurs provinces). Sans doublon,
// dans l'ordre de saisie ; un texte non reconnu est ignoré.
export function provincesOf(value) {
  const names = Array.isArray(value) ? value : [value];
  const found = names.map(findProvince).filter(Boolean);
  return found.filter((p, i) => found.indexOf(p) === i);
}

// Lieux de référence : la RDC, ses 26 provinces et leurs territoires (les
// communes pour Kinshasa). Créés s'ils manquent, sans toucher aux lieux
// existants : la carte de l'accueil et l'exploration par lieu en dépendent.
export async function ensureAdminPlaces(prisma) {
  const existing = await prisma.place.findMany({ select: { id: true, name: true, parentId: true, type: true } });
  const find = (name, parentId) => existing.find((p) => p.name === name && (p.parentId ?? null) === (parentId ?? null));
  const ensure = async (name, type, parentId = null) => {
    const found = find(name, parentId);
    if (found) return found;
    const created = await prisma.place.create({ data: { name, type, parentId }, select: { id: true, name: true, parentId: true, type: true } });
    existing.push(created);
    return created;
  };
  const country = await ensure('République démocratique du Congo', 'COUNTRY');
  for (const province of RDC_DIVISIONS.provinces) {
    const p = await ensure(province.name, 'PROVINCE', country.id);
    for (const name of province.territories) await ensure(name, province.unit === 'commune' ? 'COMMUNE' : 'TERRITORY', p.id);
  }
  return existing;
}

// Lieux d'une communauté d'après les provinces et les territoires cochés :
// pour chaque province, ses territoires cochés (ou, à défaut, la province
// elle-même) sont rattachés s'ils ne le sont pas déjà. Les rattachements
// existants ne sont jamais retirés.
export async function linkCommunityPlaces(prisma, communityId, provinceValue, territories = []) {
  const provinces = provincesOf(provinceValue);
  if (!provinces.length) return 0;
  const places = await ensureAdminPlaces(prisma);
  const country = places.find((p) => p.type === 'COUNTRY' && !p.parentId && p.name === 'République démocratique du Congo');
  const ids = provinces.flatMap((province) => {
    const provincePlace = places.find((p) => p.name === province.name && p.parentId === country?.id);
    const wanted = territories.filter((name) => province.territories.includes(name));
    return wanted.length ? places.filter((p) => p.parentId === provincePlace.id && wanted.includes(p.name)).map((p) => p.id) : [provincePlace.id];
  });
  const already = new Set((await prisma.communityPlace.findMany({ where: { communityId }, select: { placeId: true } })).map((cp) => cp.placeId));
  const missing = ids.filter((id) => !already.has(id));
  for (const placeId of missing) await prisma.communityPlace.create({ data: { communityId, placeId, notes: 'D’après le dossier de collecte.' } });
  return missing.length;
}

// Rattrapage : une communauté publiée sans aucun lieu est rattachée à la
// province et aux territoires de son dossier publié le plus récent. Une
// communauté qui a déjà des lieux n'est pas modifiée.
export async function linkPublishedCommunities(prisma) {
  const dossiers = await prisma.collectionDossier.findMany({
    where: { status: 'PUBLISHED', communityId: { not: null }, community: { places: { none: {} } } },
    orderBy: { publishedAt: 'desc' },
    select: { communityId: true, data: true },
  });
  const done = new Set();
  for (const d of dossiers) {
    if (done.has(d.communityId)) continue;
    done.add(d.communityId);
    let values = {};
    try {
      values = JSON.parse(d.data).sections?.identification?.values ?? {};
    } catch {
      continue;
    }
    const territories = Array.isArray(values.territoire) ? values.territoire : territoriesInText(values.province, values.territoire);
    await linkCommunityPlaces(prisma, d.communityId, values.province, territories);
  }
}
