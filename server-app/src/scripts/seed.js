// Données de référence initiales. Le script peut être relancé sans créer de
// doublons. Usage : npm run seed
//
// Il ne crée aucun contenu culturel : seulement la structure prévue par le
// cahier des charges (catégories §11, champs spécialisés §20 à §23,
// questionnaire §26), le découpage administratif de la RDC et le dossier
// vide de la communauté pilote Havu (§75), non publié.
import { prisma } from '../db.js';
import { normalizeSearch } from '../lib/text.js';
import { recordAudit } from '../services/audit.js';
import { ensureSectionDefs } from '../services/dossierSchema.js';

const CATEGORIES = [
  {
    code: 'A',
    slug: 'identite-et-presentation',
    name: 'Identité et présentation',
    description: 'Origine du nom, autodésignation et dénominations historiques, présentation générale, répartition géographique, relations avec d’autres communautés.',
  },
  {
    code: 'B',
    slug: 'histoire-et-memoire-collective',
    name: 'Histoire et mémoire collective',
    description: 'Origines selon les sources, traditions orales, récits historiques, migrations, établissement des villages, personnalités et événements, archives et témoignages d’époque. Les récits traditionnels sont identifiés comme tels.',
  },
  {
    code: 'C',
    slug: 'langues-et-expressions',
    name: 'Langues et expressions',
    description: 'Langues et variantes, écriture, vocabulaire, expressions, proverbes et dictons, traductions, chansons, contes en langue originale, prononciation, glossaires.',
    fields: [
      { key: 'originalExpression', label: 'Expression en langue originale', type: 'text' },
      { key: 'literalTranslation', label: 'Traduction littérale', type: 'text' },
      { key: 'meaning', label: 'Sens et explication', type: 'longtext' },
      { key: 'usageContext', label: 'Contexte d’utilisation', type: 'longtext' },
    ],
  },
  {
    code: 'D',
    slug: 'gastronomie-et-alimentation',
    name: 'Gastronomie et alimentation',
    description: 'Plats traditionnels, ingrédients et noms locaux, recettes, techniques, ustensiles, conservation, service, occasions, variantes et histoires associées.',
    fields: [
      { key: 'localNames', label: 'Dénominations locales', type: 'list' },
      { key: 'ingredients', label: 'Ingrédients', type: 'list' },
      { key: 'quantities', label: 'Quantités connues', type: 'longtext' },
      { key: 'utensils', label: 'Ustensiles', type: 'list' },
      { key: 'steps', label: 'Étapes de préparation', type: 'list' },
      { key: 'cookingTechniques', label: 'Techniques de cuisson', type: 'longtext' },
      { key: 'duration', label: 'Durée approximative', type: 'text' },
      { key: 'conservation', label: 'Modes de conservation', type: 'longtext' },
      { key: 'serving', label: 'Manière de servir', type: 'longtext' },
      { key: 'occasions', label: 'Occasions de consommation', type: 'longtext' },
      { key: 'variants', label: 'Variantes régionales ou familiales', type: 'longtext' },
      { key: 'collectionInfo', label: 'Sources et dates de collecte', type: 'text' },
    ],
  },
  {
    code: 'E',
    slug: 'danses-musique-et-arts',
    name: 'Danses, musique et expressions artistiques',
    description: 'Danses, origines et récits associés, contextes, instruments, rythmes, chants, costumes, gestes, apprentissage, démonstrations, variantes contemporaines.',
    fields: [
      { key: 'localNames', label: 'Appellations locales', type: 'list' },
      { key: 'origins', label: 'Origines connues et niveau de certitude', type: 'longtext' },
      { key: 'contexts', label: 'Contextes de pratique', type: 'longtext' },
      { key: 'steps', label: 'Étapes et gestes documentés', type: 'list' },
      { key: 'instruments', label: 'Instruments', type: 'list' },
      { key: 'costumes', label: 'Costumes', type: 'list' },
      { key: 'rhythmsAndSongs', label: 'Rythmes et chants associés', type: 'longtext' },
      { key: 'variants', label: 'Variantes', type: 'longtext' },
      { key: 'culturalRestrictions', label: 'Restrictions culturelles éventuelles', type: 'longtext' },
      { key: 'reuseConditions', label: 'Conditions de consultation et de réutilisation', type: 'longtext' },
    ],
  },
  {
    code: 'F',
    slug: 'contes-legendes-et-litterature-orale',
    name: 'Contes, légendes et littérature orale',
    description: 'Contes, légendes, fables, récits oraux, proverbes, énigmes, histoires pour enfants, versions originales, transcriptions et traductions. Les variantes d’un même récit sont conservées séparément.',
    fields: [
      { key: 'narrativeType', label: 'Type de récit', type: 'text' },
      { key: 'collectionDatePlace', label: 'Date et lieu de collecte', type: 'text' },
      { key: 'testimonyContext', label: 'Contexte du témoignage', type: 'longtext' },
      { key: 'frenchSummary', label: 'Résumé en français', type: 'longtext' },
      { key: 'variantsInfo', label: 'Informations sur les variantes', type: 'longtext' },
      { key: 'broadcastConditions', label: 'Conditions de diffusion', type: 'longtext' },
      { key: 'restrictions', label: 'Restrictions éventuelles', type: 'longtext' },
    ],
  },
  {
    code: 'G',
    slug: 'coutumes-ceremonies-et-traditions',
    name: 'Coutumes, cérémonies et traditions',
    description: 'Mariage, naissance, passage à l’âge adulte, funérailles et deuil, cérémonies, fêtes, hospitalité, traditions familiales et communautaires. Les pratiques sensibles ou réservées ne sont jamais publiées automatiquement.',
  },
  {
    code: 'H',
    slug: 'famille-et-organisation-sociale',
    name: 'Famille et organisation sociale',
    description: 'Parenté et termes de parenté, transmission des noms, rôles sociaux documentés, autorités traditionnelles, organisation communautaire, solidarité, évolutions.',
  },
  {
    code: 'I',
    slug: 'vetements-coiffures-et-parures',
    name: 'Vêtements, coiffures et parures',
    description: 'Vêtements traditionnels, matériaux, techniques, coiffures, bijoux, ornements, symboles documentés, contextes, variantes historiques et contemporaines.',
  },
  {
    code: 'J',
    slug: 'artisanat-et-savoir-faire',
    name: 'Artisanat et savoir-faire',
    description: 'Poterie, tissage, sculpture, vannerie, instruments, bois, fibres, construction, objets, étapes de fabrication, outils, matériaux, transmission.',
  },
  {
    code: 'K',
    slug: 'habitat-et-environnement',
    name: 'Habitat et environnement',
    description: 'Habitations, techniques et matériaux, organisation des espaces, agriculture, pêche, chasse documentée, cueillette, gestion des ressources.',
  },
  {
    code: 'L',
    slug: 'savoirs-traditionnels',
    name: 'Savoirs traditionnels',
    description: 'Connaissances agricoles et écologiques, conservation des aliments, pratiques artisanales, usages des plantes lorsque leur publication est autorisée. Les informations thérapeutiques sont contextualisées et distinguées des recommandations médicales.',
  },
  {
    code: 'M',
    slug: 'jeux-sports-et-divertissements',
    name: 'Jeux, sports et divertissements',
    description: 'Jeux traditionnels, règles, matériel, chants et formules, variantes locales, démonstrations, transmission aux enfants.',
  },
  {
    code: 'N',
    slug: 'vie-quotidienne-et-evolution-contemporaine',
    name: 'Vie quotidienne et évolution contemporaine',
    description: 'Activités quotidiennes, vie communautaire, pratiques actuelles, changements générationnels, urbanisation, diaspora, renouvellement des traditions.',
  },
  {
    code: 'O',
    slug: 'patrimoine-materiel-et-archives',
    name: 'Patrimoine matériel et archives',
    description: 'Objets historiques, sites, monuments, photographies anciennes, cartes, manuscrits, documents d’archives, enregistrements historiques, collections.',
    fields: [
      { key: 'author', label: 'Auteur ou photographe', type: 'text' },
      { key: 'peopleDepicted', label: 'Personnes représentées (si identification fiable et autorisée)', type: 'longtext' },
      { key: 'historicalContext', label: 'Contexte historique', type: 'longtext' },
      { key: 'provenance', label: 'Provenance', type: 'longtext' },
      { key: 'holder', label: 'Propriétaire ou détenteur du document', type: 'text' },
      { key: 'reuseRights', label: 'Droits et conditions de réutilisation', type: 'longtext' },
      { key: 'digitizationQuality', label: 'Qualité de la numérisation', type: 'text' },
      { key: 'derivedVersions', label: 'Versions restaurées ou dérivées', type: 'longtext' },
    ],
  },
];

// Découpage administratif en vigueur depuis 2015 (26 provinces).
const PROVINCES = [
  'Kinshasa', 'Kongo-Central', 'Kwango', 'Kwilu', 'Mai-Ndombe', 'Équateur', 'Mongala',
  'Nord-Ubangi', 'Sud-Ubangi', 'Tshuapa', 'Tshopo', 'Bas-Uele', 'Haut-Uele', 'Ituri',
  'Nord-Kivu', 'Sud-Kivu', 'Maniema', 'Haut-Katanga', 'Haut-Lomami', 'Lualaba',
  'Tanganyika', 'Lomami', 'Sankuru', 'Kasaï', 'Kasaï-Central', 'Kasaï-Oriental',
];

const SUD_KIVU_TERRITORIES = ['Fizi', 'Idjwi', 'Kabare', 'Kalehe', 'Mwenga', 'Shabunda', 'Uvira', 'Walungu'];

const GENERAL_QUESTIONS = [
  'Comment la communauté se désigne-t-elle ?',
  'Quelles langues sont utilisées ?',
  'Quels sont les lieux historiquement associés à la communauté ?',
  'Quels récits sont transmis entre générations ?',
  'Quels plats et savoir-faire sont importants ?',
  'Quelles danses, musiques et expressions artistiques sont pratiquées ?',
  'Quelles traditions familiales ou collectives sont documentées ?',
  'Comment ces pratiques ont-elles évolué ?',
  'Quelles différences existe-t-il entre les localités ou les générations ?',
  'Quelles sources permettent de compléter le témoignage ?',
  'Quels éléments ne doivent pas être publiés ?',
  'Qui pourrait apporter un témoignage complémentaire ?',
];

async function upsertPlace(name, type, parentId) {
  const existing = await prisma.place.findFirst({ where: { name, parentId: parentId ?? null } });
  return existing ?? prisma.place.create({ data: { name, type, parentId } });
}

let created = 0;

for (const [position, c] of CATEGORIES.entries()) {
  const data = {
    name: c.name,
    code: c.code,
    description: c.description,
    position,
    fieldsSchema: c.fields ? JSON.stringify(c.fields) : null,
  };
  const existing = await prisma.category.findUnique({ where: { slug: c.slug } });
  if (!existing) {
    await prisma.category.create({ data: { slug: c.slug, ...data } });
    created++;
  }
}

const rdc = await upsertPlace('République démocratique du Congo', 'COUNTRY', null);
for (const province of PROVINCES) await upsertPlace(province, 'PROVINCE', rdc.id);
const sudKivu = await prisma.place.findFirst({ where: { name: 'Sud-Kivu', parentId: rdc.id } });
for (const territory of SUD_KIVU_TERRITORIES) await upsertPlace(territory, 'TERRITORY', sudKivu.id);
await upsertPlace('Bukavu', 'CITY', sudKivu.id);

if (!(await prisma.questionnaire.findUnique({ where: { slug: 'questionnaire-general' } }))) {
  await prisma.questionnaire.create({
    data: {
      slug: 'questionnaire-general',
      title: 'Questionnaire général de collecte',
      description: 'Base commune (§26) à adapter aux pratiques, aux langues et aux particularités de chaque communauté.',
      questions: JSON.stringify(GENERAL_QUESTIONS),
    },
  });
  created++;
}

// Dossier pilote Havu : structure seulement, non publié. Les localisations et
// la langue indiquées sont des références de départ à vérifier et sourcer
// pendant le pilote.
let havu = await prisma.community.findUnique({ where: { slug: 'havu' } });
if (!havu) {
  const kihavu =
    (await prisma.language.findUnique({ where: { name: 'Kihavu' } })) ??
    (await prisma.language.create({ data: { name: 'Kihavu', isoCode: 'hav', notes: 'Référence initiale à vérifier pendant le pilote.' } }));
  const idjwi = await prisma.place.findFirst({ where: { name: 'Idjwi', parentId: sudKivu.id } });
  const kalehe = await prisma.place.findFirst({ where: { name: 'Kalehe', parentId: sudKivu.id } });
  havu = await prisma.community.create({
    data: {
      slug: 'havu',
      name: 'Havu',
      documentationStatus: 'NOT_STARTED',
      documentationNote: 'Communauté pilote d’URITHI. La documentation est en préparation : aucune information n’est encore validée.',
      isPublished: false,
      searchText: normalizeSearch('Havu'),
      names: { create: [{ name: 'Havu', kind: 'PRIMARY' }] },
      places: {
        create: [idjwi, kalehe].map((p) => ({ placeId: p.id, notes: 'Localisation de départ à confirmer et sourcer pendant le pilote.' })),
      },
      languages: { create: [{ languageId: kihavu.id, notes: 'À confirmer pendant le pilote.' }] },
    },
  });
  created++;
}

await recordAudit({ action: 'SEED_APPLIED', details: { created } });
// Étapes de référence du formulaire de collecte.
await ensureSectionDefs(prisma);
await prisma.$disconnect();

console.log(`Données de référence en place (${created} nouveaux éléments principaux).`);
