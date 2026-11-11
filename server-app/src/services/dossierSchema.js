import { parseJson } from '../lib/text.js';

// Étapes de référence du formulaire de collecte. Elles sont créées en base au
// démarrage (DossierSectionDef) ; l'administrateur peut ensuite les adapter,
// les désactiver ou en ajouter, sans modifier le code.
//
// Types de champs : text, longtext, list (une valeur par ligne), select
// (options), date (texte libre : date exacte ou approximative), province
// (une des 26 provinces) et territories (territoires de cette province,
// plusieurs possibles ; voir data/rdcDivisions.json). Réservés aux
// témoignages : person, consent, media, sections. Réservés aux autorités :
// entryRef / entryRefs (autre élément de la même étape), links (élément lié et
// nature du lien), events (événements datés). `group` range un champ d'élément
// dans un volet repliable (libellés dans `entry.groups`).
// `kind` : standard, identification, authorities, testimonies, sources, media, review.
// `categoryCode` : catégorie des fiches créées à la publication.

const f = (key, label, type = 'longtext', extra = {}) => ({ key, label, type, ...extra });

export const DEFAULT_SECTIONS = [
  {
    key: 'identification',
    kind: 'identification',
    title: 'Identification de la communauté',
    description: 'Les noms, la localisation et une présentation générale de la communauté.',
    categoryCode: 'A',
    mediaHint: 'Photographies représentatives, cartes, documents historiques et autres fichiers justificatifs.',
    fields: [
      f('nomPrincipal', 'Nom principal de la communauté', 'text'),
      f('autresNoms', 'Autres noms, variantes et appellations historiques', 'list', { help: 'Un nom par ligne.' }),
      f('origineNom', 'Origine et signification du nom'),
      f('groupeLinguistique', 'Groupe linguistique ou famille culturelle', 'text'),
      f('province', 'Province', 'province'),
      f('territoire', 'Territoires', 'territories', { help: 'Cochez tous les territoires où la communauté est présente.' }),
      f('repartition', 'Répartition géographique et principales zones d’implantation'),
      f('voisins', 'Communautés voisines et relations historiques'),
      f('indicationGeo', 'Carte ou indication géographique', 'longtext', { help: 'Repères, coordonnées ou description de la carte jointe.' }),
      f('presentation', 'Présentation générale de la communauté'),
    ],
  },
  {
    key: 'histoire',
    title: 'Histoire et origines',
    description: 'Distinguez toujours les faits établis des récits traditionnels.',
    categoryCode: 'B',
    mediaHint: 'Documents historiques, archives, photographies anciennes, cartes, vidéos et enregistrements de témoignages.',
    fields: [
      f('origines', 'Origines connues ou traditions relatives à l’origine'),
      f('recitsFondateurs', 'Récits fondateurs et traditions orales'),
      f('migrations', 'Anciennes migrations et déplacements'),
      f('figures', 'Personnages historiques et figures marquantes'),
      f('evolution', 'Évolution de la communauté au fil du temps'),
      f('relations', 'Relations avec d’autres communautés'),
    ],
    entry: {
      label: 'Événement ou période',
      plural: 'Événements et périodes',
      titleField: 'titre',
      fields: [
        f('titre', 'Événement', 'text', { required: true }),
        f('periode', 'Date ou période', 'date', { help: 'Précise ou approximative, par exemple « vers 1920 ».' }),
        f('nature', 'Nature de l’information', 'select', { options: ['Fait établi', 'Récit traditionnel', 'Hypothèse', 'À confirmer'] }),
        f('description', 'Description'),
      ],
    },
  },
  {
    // Autorités royales, coutumières ou autres, selon l'organisation propre à
    // chaque communauté. Chaque autorité est une fiche courte ; ses relations
    // (prédécesseur, parents, autres liens) forment l'arbre public.
    key: 'autorites',
    kind: 'authorities',
    position: 15,
    title: 'Autorités et dynasties',
    description:
      'Rois, reines, chefs coutumiers ou autres autorités, selon l’organisation propre à la communauté. Une fiche courte par autorité : seuls le nom et la nature de l’information sont essentiels, tout le reste est facultatif.',
    categoryCode: 'B',
    mediaHint: 'Portraits, photographies anciennes, objets du pouvoir, documents d’archives et enregistrements de généalogies récitées.',
    fields: [
      f('organisation', 'Forme d’organisation du pouvoir', 'select', {
        options: ['Royaume ou monarchie', 'Chefferie', 'Organisation lignagère ou clanique', 'Conseil d’anciens', 'Sans autorité centrale', 'Organisation mixte', 'Autre'],
      }),
      f('presentation', 'Présentation de l’organisation politique'),
      f('lignees', 'Lignées, dynasties ou clans dirigeants', 'list', { help: 'Une lignée par ligne.' }),
      f('succession', 'Règles d’accession au pouvoir et de succession'),
    ],
    entry: {
      label: 'Autorité',
      plural: 'Autorités',
      titleField: 'nom',
      groups: {
        relations: 'Liens avec d’autres autorités',
        evenements: 'Événements et campagnes',
        complements: 'Compléments',
      },
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('titre', 'Titre porté', 'text', { help: 'Dans la langue de la communauté, si possible.' }),
        f('type', 'Fonction', 'select', {
          options: [
            'Roi', 'Reine', 'Souverain ou souveraine', 'Reine mère', 'Régent ou régente', 'Chef coutumier', 'Chef de terre',
            'Chef de clan ou de lignage', 'Chef religieux ou spirituel', 'Notable ou conseiller', 'Conseil ou assemblée', 'Autre',
          ],
        }),
        f('lignee', 'Lignée ou dynastie', 'text', { help: 'Le même nom pour toutes les autorités d’une même lignée.' }),
        f('debut', 'Début du règne ou de la fonction', 'date', { help: 'Exact ou approximatif, par exemple « vers 1850 ».' }),
        f('fin', 'Fin du règne ou de la fonction', 'date'),
        f('nature', 'Nature de l’information', 'select', { options: ['Fait vérifié', 'Tradition orale', 'À confirmer'] }),
        f('predecesseur', 'Prédécesseur', 'entryRef', { group: 'relations' }),
        f('parents', 'Parents (parmi les autorités)', 'entryRefs', { group: 'relations' }),
        f('liens', 'Autres liens familiaux ou politiques', 'links', {
          group: 'relations',
          options: ['Conjoint ou conjointe', 'Frère ou sœur', 'Allié', 'Rival ou adversaire', 'Régent pour', 'Conseiller de', 'Autre lien'],
        }),
        f('evenements', 'Événements marquants', 'events', {
          group: 'evenements',
          options: ['Campagne militaire', 'Expédition', 'Conquête', 'Alliance', 'Conflit', 'Réforme', 'Traité ou accord', 'Fondation', 'Autre'],
        }),
        f('autresNoms', 'Autres noms ou noms de règne', 'list', { group: 'complements' }),
        f('biographie', 'Biographie', 'longtext', { group: 'complements' }),
        f('accession', 'Accession au pouvoir et succession', 'longtext', { group: 'complements' }),
        f('realisations', 'Réalisations', 'longtext', { group: 'complements' }),
        f('impact', 'Impact politique, social, culturel et économique', 'longtext', { group: 'complements' }),
        f('relationsExterieures', 'Alliances, conflits, réformes et relations avec d’autres communautés', 'longtext', { group: 'complements' }),
        f('heritage', 'Héritage et influence aujourd’hui', 'longtext', { group: 'complements' }),
      ],
    },
  },
  {
    key: 'langue',
    title: 'Langue et expressions orales',
    categoryCode: 'C',
    mediaHint: 'Enregistrements audio, vidéos, documents linguistiques, textes et transcriptions.',
    fields: [
      f('nomLangue', 'Nom de la langue', 'text'),
      f('variantes', 'Variantes de la langue', 'list'),
      f('autresLangues', 'Autres langues utilisées par la communauté', 'list'),
      f('usages', 'Répartition géographique et usages linguistiques'),
      f('ecriture', 'Alphabet et système d’écriture'),
      f('prononciation', 'Prononciation et explications linguistiques utiles'),
      f('transmission', 'Risques de disparition ou initiatives de transmission'),
    ],
    entry: {
      label: 'Expression orale',
      plural: 'Vocabulaire, proverbes, contes et chants',
      titleField: 'originalExpression',
      fields: [
        f('originalExpression', 'Expression dans la langue', 'text', { required: true }),
        f('type', 'Type', 'select', { options: ['Mot ou vocabulaire', 'Expression', 'Proverbe', 'Dicton', 'Devinette', 'Conte', 'Légende', 'Récit', 'Chant'] }),
        f('literalTranslation', 'Traduction française', 'text'),
        f('meaning', 'Sens culturel et explication'),
        f('usageContext', 'Contexte d’utilisation'),
        f('pronunciation', 'Prononciation', 'text'),
      ],
    },
  },
  {
    key: 'organisation',
    title: 'Organisation sociale et familiale',
    categoryCode: 'H',
    fields: [
      f('famille', 'Organisation familiale et liens de parenté'),
      f('communautaire', 'Organisation communautaire traditionnelle'),
      f('chefferie', 'Chefferie et autorités coutumières'),
      f('succession', 'Règles de succession et de transmission'),
      f('roles', 'Rôles sociaux et responsabilités traditionnelles'),
      f('entraide', 'Systèmes d’entraide et de solidarité'),
      f('reglesVie', 'Règles de vie communautaire'),
      f('evolution', 'Évolution des structures sociales'),
      f('differences', 'Différences entre pratiques historiques et contemporaines'),
    ],
  },
  {
    key: 'gastronomie',
    title: 'Gastronomie et alimentation',
    categoryCode: 'D',
    mediaHint: 'Photographies des plats, vidéos de préparation, recettes documentées et témoignages.',
    fields: [
      f('produitsLocaux', 'Produits agricoles, plantes et ressources alimentaires locales'),
      f('habitudes', 'Habitudes alimentaires'),
      f('repasCirconstance', 'Repas de circonstance et plats de cérémonie'),
      f('signification', 'Signification culturelle des aliments'),
      f('evolution', 'Évolution des pratiques culinaires et transmission des recettes'),
    ],
    entry: {
      label: 'Plat ou boisson',
      plural: 'Plats et boissons',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom du plat ou de la boisson', 'text', { required: true }),
        f('localNames', 'Noms locaux', 'list'),
        f('type', 'Type', 'select', { options: ['Plat', 'Boisson', 'Aliment', 'Produit'] }),
        f('ingredients', 'Ingrédients', 'list'),
        f('steps', 'Étapes de préparation', 'list'),
        f('cookingTechniques', 'Techniques de cuisson'),
        f('conservation', 'Techniques de conservation'),
        f('occasions', 'Occasions, cérémonies ou événements'),
        f('signification', 'Signification culturelle'),
        f('variants', 'Variantes régionales ou familiales'),
      ],
    },
  },
  {
    key: 'vetements',
    title: 'Vêtements, coiffures et parures',
    categoryCode: 'I',
    mediaHint: 'Photographies, vidéos, dessins documentaires et documents historiques.',
    fields: [f('evolution', 'Évolution des vêtements et pratiques contemporaines')],
    entry: {
      label: 'Vêtement, coiffure ou parure',
      plural: 'Vêtements, coiffures et parures',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('nomLocal', 'Nom local', 'text'),
        f('type', 'Type', 'select', { options: ['Vêtement', 'Accessoire', 'Coiffure', 'Bijou', 'Ornement', 'Parure'] }),
        f('matieres', 'Matières premières et techniques de fabrication'),
        f('signification', 'Signification des couleurs, motifs et accessoires'),
        f('usage', 'Cérémonies ou fonctions sociales associées'),
        f('evolution', 'Évolution'),
      ],
    },
  },
  {
    key: 'artisanat',
    title: 'Arts, artisanat et savoir-faire',
    categoryCode: 'J',
    mediaHint: 'Photographies des objets, vidéos de fabrication, documents techniques et témoignages d’artisans.',
    fields: [
      f('transmission', 'Transmission des techniques entre générations'),
      f('conservation', 'Protection et conservation des objets patrimoniaux'),
    ],
    entry: {
      label: 'Art ou savoir-faire',
      plural: 'Arts, objets et savoir-faire',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('type', 'Type', 'select', {
          options: ['Sculpture', 'Peinture', 'Arts décoratifs', 'Poterie', 'Vannerie', 'Tissage', 'Travail du bois', 'Instrument', 'Objet traditionnel', 'Autre'],
        }),
        f('description', 'Description'),
        f('techniques', 'Techniques et matériaux utilisés'),
        f('symboles', 'Symboles, motifs et significations'),
        f('artisans', 'Artisans et détenteurs du savoir-faire'),
      ],
    },
  },
  {
    key: 'musique',
    title: 'Musique, danses et spectacles',
    categoryCode: 'E',
    mediaHint: 'Fichiers audio, vidéos, photographies, paroles transcrites et traductions.',
    fields: [
      f('genres', 'Genres musicaux traditionnels'),
      f('transmission', 'Transmission et évolution des pratiques'),
      f('differences', 'Différences régionales ou locales'),
    ],
    entry: {
      label: 'Danse, chant ou musique',
      plural: 'Danses, chants, instruments et musiques',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('localNames', 'Appellations locales', 'list'),
        f('type', 'Type', 'select', { options: ['Genre musical', 'Instrument', 'Chant', 'Rythme', 'Danse', 'Spectacle'] }),
        f('contexts', 'Signification et circonstances d’exécution'),
        f('instruments', 'Instruments', 'list'),
        f('rhythmsAndSongs', 'Paroles, rythmes et chants'),
        f('traduction', 'Traduction des paroles'),
        f('interpretes', 'Artistes, musiciens et détenteurs de la tradition'),
        f('variants', 'Variantes'),
      ],
    },
  },
  {
    key: 'ceremonies',
    title: 'Cérémonies, rites et traditions',
    categoryCode: 'G',
    sensitiveNotice: true,
    description: 'Ne documentez que ce qui peut être partagé. Signalez tout contenu confidentiel ou réservé.',
    fields: [f('evolution', 'Évolution des traditions au fil du temps')],
    entry: {
      label: 'Cérémonie, rite ou tradition',
      plural: 'Cérémonies, rites et traditions',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('type', 'Type', 'select', {
          options: ['Naissance et accueil', 'Initiation', 'Rite de passage', 'Mariage', 'Funérailles et deuil', 'Cérémonie communautaire', 'Commémoration', 'Tradition saisonnière', 'Autre'],
        }),
        f('deroulement', 'Déroulement'),
        f('signification', 'Signification'),
        f('symboles', 'Symboles, objets et vêtements associés'),
        f('evolution', 'Évolution'),
      ],
    },
  },
  {
    key: 'croyances',
    title: 'Croyances, spiritualité et représentations du monde',
    categoryCode: 'G',
    sensitiveNotice: true,
    description: 'Respectez les sensibilités. Distinguez les témoignages, les croyances rapportées et les faits historiquement établis.',
    fields: [
      f('representations', 'Représentations traditionnelles du monde et de la nature'),
      f('recits', 'Récits spirituels et cosmologies'),
      f('symboles', 'Symboles et objets à signification spirituelle'),
      f('pratiques', 'Pratiques et traditions religieuses ou spirituelles'),
      f('relations', 'Relations entre traditions anciennes et pratiques contemporaines'),
      f('mythes', 'Récits, mythes et explications culturelles'),
      f('evolutions', 'Évolutions et continuités observées'),
    ],
  },
  {
    key: 'nature',
    title: 'Médecine traditionnelle et connaissances de la nature',
    categoryCode: 'L',
    sensitiveNotice: true,
    description:
      'Présentez les usages comme des savoirs documentés ou des pratiques rapportées, jamais comme des traitements dont l’efficacité est démontrée.',
    fields: [
      f('savoirs', 'Connaissances relatives aux plantes et à l’environnement'),
      f('agriculture', 'Connaissances agricoles, forestières et écologiques'),
      f('techniques', 'Techniques de pêche, de chasse ou d’élevage'),
      f('conservation', 'Pratiques de conservation de la nature'),
      f('transmission', 'Détenteurs de ces connaissances et modes de transmission'),
    ],
    entry: {
      label: 'Plante ou espèce',
      plural: 'Plantes et espèces',
      titleField: 'nomLocal',
      fields: [
        f('nomLocal', 'Nom local', 'text', { required: true }),
        f('nomCourant', 'Nom courant ou scientifique, si connu', 'text'),
        f('usages', 'Usages traditionnels rapportés'),
        f('notes', 'Précisions'),
      ],
    },
  },
  {
    key: 'education',
    title: 'Éducation, transmission et apprentissage',
    categoryCode: 'N',
    fields: [
      f('modes', 'Modes traditionnels d’éducation'),
      f('famille', 'Apprentissages au sein de la famille et de la communauté'),
      f('transmission', 'Transmission des langues, récits, métiers et traditions'),
      f('initiation', 'Initiation aux responsabilités communautaires'),
      f('aines', 'Rôle des aînés et des détenteurs de savoirs'),
      f('contemporain', 'Pratiques éducatives contemporaines'),
      f('initiatives', 'Initiatives de sauvegarde et d’enseignement du patrimoine'),
    ],
  },
  {
    key: 'economie',
    title: 'Économie traditionnelle et activités quotidiennes',
    categoryCode: 'N',
    fields: [
      f('agriculture', 'Agriculture et cultures locales'),
      f('elevage', 'Élevage, pêche et autres activités traditionnelles'),
      f('metiers', 'Artisanat et métiers'),
      f('commerce', 'Commerce et échanges'),
      f('travail', 'Organisation du travail'),
      f('techniques', 'Techniques de production et de transformation'),
      f('habitat', 'Habitat et architecture traditionnelle'),
      f('outils', 'Outils, équipements et objets du quotidien'),
      f('evolution', 'Évolution des activités économiques et des modes de vie'),
    ],
  },
  {
    key: 'territoire',
    title: 'Territoire, environnement et patrimoine matériel',
    categoryCode: 'K',
    mediaHint: 'Photographies, vidéos, cartes, plans, documents d’archives et coordonnées géographiques.',
    fields: [f('ressources', 'Ressources naturelles ayant une importance culturelle')],
    entry: {
      label: 'Lieu ou élément patrimonial',
      plural: 'Lieux et éléments patrimoniaux',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('type', 'Type', 'select', {
          options: ['Localité', 'Site culturel', 'Site historique', 'Habitat', 'Monument', 'Objet', 'Lieu de mémoire', 'Paysage', 'Ressource naturelle'],
        }),
        f('localisation', 'Localisation ou coordonnées géographiques'),
        f('importance', 'Importance culturelle ou historique'),
        f('etat', 'État de conservation et menaces éventuelles'),
        f('preservation', 'Initiatives de préservation et de restauration'),
      ],
    },
  },
  {
    key: 'personnalites',
    title: 'Personnalités et figures importantes',
    categoryCode: 'B',
    description: 'Respectez la vie privée : une personne vivante ne peut être présentée qu’avec son autorisation.',
    fields: [],
    entry: {
      label: 'Personnalité',
      plural: 'Personnalités',
      titleField: 'nom',
      fields: [
        f('nom', 'Nom', 'text', { required: true }),
        f('role', 'Rôle', 'select', {
          options: ['Chef ou responsable historique', 'Ancien', 'Conteur', 'Détenteur de savoirs', 'Artiste', 'Écrivain', 'Musicien', 'Artisan', 'Autre'],
        }),
        f('dates', 'Dates (naissance, décès, période d’activité)', 'date'),
        f('parcours', 'Parcours et réalisations documentées'),
        f('vivante', 'Personne vivante ?', 'select', { options: ['Oui', 'Non', 'Inconnu'] }),
        f('autorisation', 'Autorisation de la personne (si vivante)'),
      ],
    },
  },
  {
    key: 'temoignages',
    kind: 'testimonies',
    title: 'Témoignages et histoire orale',
    description: 'Un témoignage peut être rattaché à plusieurs sections, sans téléverser plusieurs fois le même fichier.',
    fields: [],
    entry: {
      label: 'Témoignage',
      plural: 'Témoignages',
      titleField: 'theme',
      fields: [
        f('theme', 'Thème du témoignage', 'text', { required: true }),
        f('temoin', 'Témoin (personne ressource)', 'person'),
        f('identifiant', 'Identifiant confidentiel (si le témoin reste anonyme)', 'text'),
        f('localite', 'Communauté et localité concernées', 'text'),
        f('date', 'Date de l’entretien', 'date'),
        f('lieu', 'Lieu de l’entretien', 'text'),
        f('questions', 'Questions posées et réponses recueillies'),
        f('transcription', 'Transcription du témoignage'),
        f('traduction', 'Traduction française'),
        f('media', 'Fichier audio ou vidéo original', 'media'),
        f('restrictions', 'Restrictions de consultation ou de publication'),
        f('notes', 'Notes du collecteur et références complémentaires'),
        f('sections', 'Sections concernées par ce témoignage', 'sections'),
      ],
    },
  },
  {
    key: 'sources',
    kind: 'sources',
    title: 'Sources et références documentaires',
    description: 'Toutes les sources du dossier, et les sections qu’elles étayent ou contredisent.',
    fields: [],
  },
  {
    key: 'medias',
    kind: 'media',
    title: 'Photographies, vidéos, audios et documents',
    description: 'La bibliothèque des fichiers du dossier. Un même fichier peut illustrer plusieurs sections.',
    fields: [],
  },
  {
    key: 'preservation',
    title: 'État actuel, évolution et préservation',
    categoryCode: 'N',
    fields: [
      f('vivantes', 'Pratiques toujours vivantes'),
      f('transformation', 'Pratiques en transformation ou en voie de disparition'),
      f('variations', 'Variations selon les localités ou les générations'),
      f('initiatives', 'Initiatives locales de préservation'),
      f('acteurs', 'Personnes ou organisations impliquées dans la transmission'),
      f('besoins', 'Besoins de documentation supplémentaires'),
      f('projets', 'Projets de sauvegarde et recommandations documentées'),
    ],
  },
  {
    key: 'verification',
    kind: 'review',
    title: 'Vérification et soumission',
    description: 'Récapitulatif du dossier avant sa soumission à l’administrateur.',
    fields: [],
  },
];

// Types d'étapes dont le contenu est publié sous forme de fiches.
export const CONTENT_KINDS = ['standard', 'identification', 'authorities'];

// Crée les étapes de référence manquantes (sans toucher aux étapes existantes,
// que l'administrateur a pu modifier).
export async function ensureSectionDefs(prisma) {
  const existing = new Set((await prisma.dossierSectionDef.findMany({ select: { key: true } })).map((d) => d.key));
  const missing = DEFAULT_SECTIONS.filter((s) => !existing.has(s.key));
  if (!missing.length) return;
  const categories = await prisma.category.findMany({ where: { parentId: null }, select: { id: true, code: true } });
  for (const def of missing) {
    await prisma.dossierSectionDef.create({
      data: {
        key: def.key,
        title: def.title,
        description: def.description ?? null,
        kind: def.kind ?? 'standard',
        position: def.position ?? DEFAULT_SECTIONS.indexOf(def) * 10,
        isDefault: true,
        categoryId: categories.find((c) => c.code === def.categoryCode)?.id ?? null,
        fields: JSON.stringify(def.fields),
        entry: def.entry ? JSON.stringify(def.entry) : null,
        mediaHint: def.mediaHint ?? null,
        sensitiveNotice: Boolean(def.sensitiveNotice),
      },
    });
  }
}

// Province et territoires de l'étape d'identification : les étapes créées
// avant ces listes avaient deux champs texte. Ils deviennent des listes, sans
// toucher aux réponses déjà saisies (un ancien texte reste lisible).
const ADMIN_FIELD_UPGRADES = { province: { type: 'province' }, territoire: { type: 'territories', label: 'Territoires', help: 'Cochez tous les territoires où la communauté est présente.' } };
// Champs retirés de l'identification : la liste des territoires les remplace.
// Les réponses déjà saisies restent dans les dossiers, seul le champ disparaît
// du formulaire.
const REMOVED_IDENTIFICATION_FIELDS = ['secteurChefferie', 'localites'];

async function upgradeAdminFields(prisma) {
  const def = await prisma.dossierSectionDef.findFirst({ where: { kind: 'identification' } });
  if (!def) return;
  const fields = parseJson(def.fields, []);
  let changed = fields.some((field) => REMOVED_IDENTIFICATION_FIELDS.includes(field.key));
  const next = fields.filter((field) => !REMOVED_IDENTIFICATION_FIELDS.includes(field.key)).map((field) => {
    const upgrade = ADMIN_FIELD_UPGRADES[field.key];
    if (!upgrade || field.type !== 'text') return field;
    changed = true;
    return { ...field, ...upgrade };
  });
  if (changed) await prisma.dossierSectionDef.update({ where: { id: def.id }, data: { fields: JSON.stringify(next) } });
}

export function serializeDef(def) {
  return { ...def, fields: parseJson(def.fields, []), entry: parseJson(def.entry, null) };
}

export async function loadSectionDefs(prisma, { activeOnly = false } = {}) {
  await ensureSectionDefs(prisma);
  await upgradeAdminFields(prisma);
  const defs = await prisma.dossierSectionDef.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { category: { select: { id: true, name: true, code: true } } },
  });
  return defs.map(serializeDef);
}

const filled = (value) => (Array.isArray(value) ? value.some((v) => String(v).trim()) : Boolean(String(value ?? '').trim()));

// Avancement d'une étape : un champ compte comme renseigné s'il a une valeur
// ou s'il est explicitement marqué « inconnu », « non documenté » ou « à
// confirmer ». Une étape marquée « non documentée » est complète.
export function sectionCompletion(def, section = {}) {
  if (!CONTENT_KINDS.includes(def.kind) && def.kind !== 'testimonies') return null;
  const fields = def.kind === 'testimonies' ? [] : def.fields;
  const total = fields.length + (def.entry ? 1 : 0);
  if (!total) return null;
  if (section.notDocumented) return { done: total, total };
  const values = section.values ?? {};
  const status = section.fieldStatus ?? {};
  let done = fields.filter((field) => filled(values[field.key]) || status[field.key]).length;
  if (def.entry && (section.entries ?? []).length) done += 1;
  return { done, total };
}

export function dossierProgress(defs, data) {
  let done = 0;
  let total = 0;
  for (const def of defs) {
    const c = sectionCompletion(def, data.sections?.[def.key]);
    if (!c) continue;
    done += c.done;
    total += c.total;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

// Une étape contient-elle des informations saisies ?
export function sectionHasContent(def, section = {}) {
  return (
    Object.values(section.values ?? {}).some(filled) ||
    (section.entries ?? []).length > 0 ||
    (section.media ?? []).length > 0 ||
    (section.sources ?? []).length > 0
  );
}
