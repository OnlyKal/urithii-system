# URITHI — Document de conception

Référence fonctionnelle : [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md). Dernière mise à jour : 25 octobre 2026.

---

## 1. Avancement

| Phase (§78 à §85) | État |
|---|---|
| 1. Analyse et conception | Fait (ce document) |
| 2. Socle technique : authentification, rôles, audit, stockage | Fait et testé |
| 3. Gestion documentaire : communautés, catégories, fiches, sources, médias, textes, relations, versions | Fait et testé |
| 4. Administration et validation : tableau de bord, comptes, missions, formulaires, 17 statuts, consentements, signalements, accès | Fait et testé |
| 5. Site public : accueil, répertoire, pages, médiathèque, recherche, filtres | Fait et testé |
| 6. Pilote Havu | **Prêt à démarrer.** Le dossier vide est créé ; la collecte réelle est un travail de terrain ([pilote-havu.md](editorial/pilote-havu.md)) |
| 7. Archivage et renforcement : sauvegardes, restauration, intégrité, exports | Fait et testé |
| 8. Extension nationale | Architecture prête ; passage à PostgreSQL documenté ([MIGRATION_POSTGRESQL.md](MIGRATION_POSTGRESQL.md)), à faire avant l'ouverture à grande échelle |
| Module Jeux « Les Gardiens de l'Héritage » | Phases 1 à 4 faites (menu, accueil, prototype 3D, missions, progression) ; phase 5 (autres régions, mode Histoire) à venir. Voir [MODULE_JEUX.md](MODULE_JEUX.md) |

Tests : 53 tests automatisés de l'API, plus un parcours complet dans un navigateur. Voir [TESTS.md](TESTS.md).

## 2. Technologies

| Couche | Choix |
|---|---|
| Serveur | Node.js 22, Express 5, Zod, Helmet, express-rate-limit |
| Base de données | SQLite via Prisma 7 (adaptateur better-sqlite3) |
| Médias | Multer (téléversement sur disque), Sharp (dérivés d'images) |
| Interface | React 19, React Router 7, Vite |
| Tests | `node:test`, Supertest ; Playwright pour le parcours dans le navigateur |

## 3. Architecture

Le projet est un monolithe modulaire (§71) : une API et une application web, avec une séparation nette des responsabilités.

```
server-app/src/
├── app.js, index.js         assemblage, démarrage, planificateur
├── auth/permissions.js      rôles → permissions (valeurs par défaut + personnalisation en base)
├── middleware/              session, permissions, contrôle d'origine, validation
├── routes/
│   ├── public.js            site public (lecture seule + signalements)
│   ├── auth.js, users.js, audit.js
│   └── admin/               référentiels, communautés, sources, personnes, consentements,
│                            médias, textes, fiches, missions, signalements, permissions,
│                            conservation, tableau de bord
├── services/
│   ├── access.js            règles d'accès (public, interne, médias)
│   ├── items.js             fiches, instantanés de version, conditions de publication
│   ├── workflow.js          17 statuts, transitions, séparation des rôles, publication programmée
│   ├── consents.js          validité et révocation (suspension automatique)
│   ├── media.js, storage.js téléversement, signatures de fichiers, originaux, dérivés, intégrité
│   ├── publicContent.js     préparation des contenus publics (version publiée, filtrage)
│   ├── backup.js            sauvegarde, vérification, test de restauration, intégrité
│   ├── export.js            exports public et complet
│   ├── audit.js             journal chaîné
│   └── scheduler.js         tâches périodiques
└── scripts/                 create-admin, seed, preservation (CLI)

web-app/src/
├── pages/public/            site public
├── pages/admin/             espace contributeur
└── components/              composants partagés (formulaires génériques, cartes, médias)
```

## 4. Rôles et permissions

Les permissions sont **toujours vérifiées par le serveur** (§67). Leurs valeurs par défaut sont dans `server-app/src/auth/permissions.js`. Un super administrateur peut les modifier depuis **Rôles et permissions** (§37) ; les permissions du super administrateur restent fixes, pour qu'aucune erreur de configuration ne bloque l'administration.

| Permission | Super admin | Resp. collecte | Collecteur | Transcripteur | Traducteur | Validateur | Éditeur |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| users.manage, audit.read, settings.manage | ✔ | | | | | | |
| communities.manage, categories.manage | ✔ | | | | | | |
| reports.manage, backups.manage, export.full | ✔ | | | | | | |
| missions.manage | ✔ | ✔ | | | | | |
| missions.participate, content.create | ✔ | ✔ | ✔ | | | | |
| persons.manage, consents.manage | ✔ | ✔ | ✔ | | | | |
| files.upload, sources.manage | ✔ | ✔ | ✔ | | | | ✔ |
| content.edit, content.validate_editorial, content.publish | ✔ | | | | | | ✔ |
| transcription.edit | ✔ | | | ✔ | | | |
| translation.edit | ✔ | | | | ✔ | | |
| content.validate_cultural | ✔ | | | | | ✔ | |
| games.manage (module Jeux) | ✔ | | | | | | |

## 5. Cycle de vie des fiches (§39 à §42)

Les 17 statuts du cahier des charges et leurs transitions sont définis dans `services/workflow.js`. Chaque transition indique les permissions requises.

Règles clés :
- **Version publiée distincte de la version de travail.** Le public voit uniquement la version publiée. Modifier une fiche publiée la place « en cours de révision » et crée une nouvelle version, qui reste interne jusqu'à sa nouvelle validation.
- **Conditions de publication vérifiées par le serveur** : niveau « Public », résumé, au moins une communauté, catégorie active, au moins une source ou un témoin (personne ressource), sources présentes si le statut est « sourcé » ou « corroboré ». Les consentements ne conditionnent plus la publication (décision du porteur du projet, octobre 2026) : les données de consentement déjà saisies sont conservées en base, mais ne sont plus demandées ni affichées dans l'interface. En cas d'échec, l'API répond 422 avec la liste des problèmes.
- **Séparation des rôles pour les fiches sensibles** (§38) : l'auteur ne peut ni valider ni publier sa fiche, et la publication doit être faite par une autre personne que le validateur culturel.
- **Motif obligatoire** pour les demandes de compléments, les attentes d'autorisation, les suspensions, les retraits et les archivages.
- **Publication programmée** : les conditions sont revérifiées au moment de la publication ; en cas d'échec, la fiche revient à « Validé » avec la raison.
- **Statuts de vérification** (§41) : sourcé, témoignage, tradition orale, corroboré, contesté, hypothèse, vérification incomplète. Ils sont affichés au public avec une explication.
- **Variantes** (§42) : fiches distinctes reliées par une relation « Variante de ». Aucune version n'écrase l'autre.

## 6. Versions (§43 à §45)

Chaque création ou modification enregistre un instantané complet : champs, champs spécialisés, communautés, lieux, sources, médias, consentements. L'instantané est accompagné de l'auteur, de la date, du motif et d'une note publique facultative. Deux versions peuvent être comparées champ par champ. Une restauration crée une nouvelle version et n'efface rien. L'historique public ne montre que les versions publiées, avec leur date et leur note publique.

## 7. Accès et données personnelles (§46, §47, §49)

| Niveau | Visible par |
|---|---|
| PUBLIC | Tout le monde, une fois la fiche publiée |
| CONTRIBUTORS | Tout compte actif |
| TEAM, SPECIAL | Auteur, super administrateur, titulaires d'un accès nominatif (avec date d'expiration possible) |
| PRIVATE | Auteur, super administrateur |

Les mêmes règles s'appliquent aux listes, aux accès directs, aux résultats de recherche et aux fichiers. Un élément inaccessible renvoie 404, pour ne pas révéler son existence. Les réponses publiques sont revalidées à chaque requête (`Cache-Control: no-cache`) : une restriction s'applique donc aussi aux caches.

Personnes ressources : réservées aux permissions dédiées. Le site public n'affiche que le nom autorisé (nom, pseudonyme ou mention anonyme). La révocation d'un consentement suspend automatiquement toutes les fiches publiées qui en dépendent.

## 8. Médias et conservation (§28, §50 à §54, §68)

- **Téléversement** : formats limités à une liste, avec contrôle de l'extension, du type déclaré **et de la signature réelle du fichier**. SVG et HTML sont refusés. Taille maximale configurable (`MAX_UPLOAD_MB`). Analyse antivirus facultative avec ClamAV (`CLAMSCAN_PATH`).
- **Originaux** : nom aléatoire, hors de tout dossier public, écriture sans remplacement possible, lecture seule, empreinte SHA-256. Les dérivés d'images (version web 1600 px et miniature 400 px en WebP) sont des fichiers distincts reliés à l'original, avec la description de la transformation.
- **Diffusion publique** d'un média : niveau « Public » et rattachement à une fiche publique. Choisir « Public » vaut décision de diffusion par l'administration. (Décision du porteur du projet, octobre 2026 ; auparavant, une confirmation des droits et un consentement valide étaient aussi exigés.)
- **Sauvegardes** : base (API de sauvegarde SQLite) et tous les fichiers, avec un manifeste d'empreintes et l'empreinte du manifeste. Copie miroir facultative (`BACKUP_MIRROR_DIR`). Copies en lecture seule, aucune suppression automatique. Fréquence automatique : `AUTO_BACKUP_HOURS`, 24 h par défaut.
- **Test de restauration** : restauration dans un dossier temporaire, contrôle `integrity_check` de SQLite, puis vérification de chaque fichier référencé contre le manifeste.
- **Restauration réelle** (ligne de commande) : vérifie d'abord la sauvegarde, exige `--confirm`, et déplace les données actuelles à côté au lieu de les supprimer.

## 9. Sécurité (§67 à §69)

- Comptes créés uniquement par l'administration, mots de passe temporaires à changer, hachage scrypt.
- Sessions : jeton de 256 bits, seule son empreinte est stockée ; cookie `HttpOnly`, `SameSite=Strict`, `Secure` en production ; révocation lors de la désactivation ou de la réinitialisation.
- Force brute : limitation par adresse IP et verrouillage du compte après 5 échecs.
- Falsification de requêtes : cookie `SameSite=Strict` et contrôle de l'origine.
- En-têtes de sécurité (Helmet), validation de toutes les entrées (Zod), aucun HTML interprété dans les contenus affichés.
- **Journal d'audit chaîné** : chaque entrée contient l'empreinte de la précédente, et toute altération est détectée. Limite connue : quelqu'un qui contrôle le serveur pourrait recalculer toute la chaîne. Parade recommandée : conserver hors du serveur l'empreinte de la dernière entrée, consignée dans chaque sauvegarde.

## 10. Recherche (§14)

Les fiches publiées et les communautés portent un champ `searchText` normalisé (minuscules, sans accents). Il contient le titre, le résumé, la description, les mots-clés, la catégorie, les noms et dénominations des communautés, et les champs spécialisés. Chaque mot recherché doit être présent. Les synonymes passent par les mots-clés et les dénominations documentées. Filtres disponibles : thème (sous-catégories comprises), communauté, lieu, langue, type de média, statut de vérification. Le passage à PostgreSQL permettra une recherche plein texte plus fine.

## 11. Système de design (interface)

- **Styles centralisés** dans `web-app/src/index.css` : jetons de couleur, rayons, ombres, durées d'animation et typographie déclarés dans `:root`. Il n'y a pas de second système de styles.
- **Couleurs unies uniquement** : aucun dégradé ni effet de verre. **Un seul bleu de référence, `#1E3A8A`** (variable `--blue`), celui du menu et du pied de page, sert aux actions, aux liens, aux éléments actifs, aux icônes et à la carte. Une nuance plus profonde (`--blue-hover`, `#172554`) est réservée au survol, et des teintes très claires (`#EFF6FF`, `#DBEAFE`) aux fonds. Les fonds de page sont `#FFFFFF` et `#F8FAFC`. Le succès (`#16A34A`) et l'avertissement (`#D97706`) servent aux icônes et aux bordures ; pour le texte de petite taille, des variantes plus foncées de la même teinte (`--success-text`, `--warning-text`) garantissent un contraste d'au moins 4,5:1.
- **Formes** : 7 px pour les boutons et les champs, 10 px pour les cartes, 12 px pour les boîtes de dialogue, 5 px pour les badges ; ombres légères et diffuses.
- **Logo et icônes** : logo officiel fourni par le porteur du projet, en deux versions (`web-app/public/brand/` : sur fond bleu, sur fond blanc). La version blanche est utilisée sur l'en-tête, le menu d'administration et le pied de page bleus ; la version bleue sert au favicon (16 et 32 px), à l'icône iOS (180 px) et aux icônes d'application du manifeste (`manifest.webmanifest`, 192 et 512 px). Le bleu du logo (#2838A8) est légèrement plus vif que le bleu de l'interface (#1E3A8A).
- **Typographie** : Inter, servie depuis le projet (`@fontsource-variable/inter`) sans appel à un service externe ; largeur de lecture limitée à 68 caractères.
- **Icônes** : uniquement Lucide React ; un bouton réduit à une icône porte toujours un libellé accessible.
- **Animations** : 150 à 250 ms, uniquement sur `transform` et `opacity`. Elles sont neutralisées si l'utilisateur a demandé la réduction des animations (`prefers-reduced-motion`). Les squelettes de chargement varient en opacité, sans dégradé.
- **Composants partagés** (`web-app/src/components/`) :
  - mise en page et états : `SectionHeader`, `Breadcrumbs`, `Pagination`, `StatusBadge`, `EmptyState`, `LoadingSkeleton`, `FormField` ;
  - interactions : `SearchBar`, `Modal` et `useDialog` (remplacent `confirm` et `prompt` du navigateur), `DropdownMenu` (navigable au clavier), `useToast` (notifications) ;
  - patrimoine : `CommunityCard`, `CultureContentCard`, `CollectionCard`, `CategoryItem`, `MediaCard` (agrandissement des photos), `AudioPlayer` et `VideoPlayer` (avec transcriptions), `DocumentViewer`, `SourceReference`, `ContentVersionHistory`.
- **Données réelles uniquement** : les photographies de couverture des cartes sont la première photo publique de la version publiée (ou des contenus publiés de la communauté) ; sans photo, une icône neutre s'affiche. Les compteurs des collections sont calculés par `/api/public/collections`.

### Carte interactive de la RDC (page d'accueil)
- **Composant** : `web-app/src/components/DrcMap.jsx`, en SVG, sans bibliothèque cartographique ni appel à un service externe.
- **Données** : limites des 26 provinces issues de geoBoundaries (gbOpen COD ADM1, 2017), d'après OpenStreetMap et Wambacher, sous licence **ODbL 1.0**. L'attribution « © contributeurs OpenStreetMap » est affichée sous la carte et doit être conservée.
- **Génération** : les tracés, projetés en Mercator et simplifiés à environ 42 Ko, se trouvent dans `drcMapData.js`, qui exporte aussi une fonction `project(lon, lat)` pour placer de futurs points.
- **Marqueurs** : un par province, au centre géométrique. Les provinces documentées (avec au moins une communauté publiée) ont un marqueur plein et une pulsation plus marquée. Les chiffres affichés sont les communautés publiées de la province, en remontant la hiérarchie des lieux, et les contenus publiés de ces communautés.
- **Interactions** : survol, clavier (les marqueurs sont des boutons décrits pour les lecteurs d'écran) et toucher. Sur écran tactile, le premier toucher affiche la province et le second ouvre `/explorer?lieu=…`.
- **Animations** : apparition des provinces en vague d'ouest en est, déclenchée lorsque la carte entre dans l'écran, et pulsation continue des marqueurs. L'ensemble est désactivé avec `prefers-reduced-motion`.
- **Exploration par lieu** : un lieu inclut désormais ses subdivisions (une province affiche les communautés et les contenus de ses territoires et localités), côté serveur, dans `/api/public/communities` et `/api/public/items`.

### Visuels de la page d'accueil
- **Configuration** : toutes les images sont déclarées dans `web-app/src/components/homeVisuals.js` (fichier, texte alternatif, source, statut des droits). Les fichiers WebP optimisés se trouvent dans `web-app/src/assets/home/`.
- **Statut** : ce sont des **images d'illustration** (mention « Images d'illustration » sous le collage), pas des documents patrimoniaux. **Leurs droits restent à confirmer avant toute mise en ligne publique.** Trois d'entre elles évoquent des images générées par IA ; les trois autres montrent des personnes reconnaissables, dont l'accord n'est pas documenté.
- **Images écartées** :
  - la photo portant la mention « Copyright © Nicolas Marino 2015 » (publication impossible sans l'autorisation du photographe) ;
  - la danse autour d'un feu (costumes étrangers aux traditions congolaises) ;
  - les masques portant l'inscription « MOZAMBIQUE » ;
  - les peintures de rue de style est-africain ;
  - les *pamonhas* brésiliennes.
- **Retouches** :
  - grillades de Kinshasa : recadrage de la bande inférieure, qui portait une publicité pour une bière ; l'image n'a pas été retournée, car les caisses étaient simplement posées à l'envers ;
  - foufou : recadrage d'un montage, pour ne garder qu'une seule photographie.
- **Remplacement** : à terme, ces images doivent être remplacées par des photographies issues des missions de collecte, avec consentement et droits de diffusion confirmés. Il suffit de modifier l'entrée correspondante du fichier de configuration.

### Organisation de l'espace contributeur : deux rôles
Deux types de comptes : **Administrateur** (rôle `SUPER_ADMIN`, toutes les permissions) et **Collecteur** (rôle `COLLECTEUR`, avec la permission `dossiers.collect`). Les autres rôles restent dans le modèle pour les comptes existants, sans être proposés à la création. Permissions ajoutées : `dossiers.collect` (collecteur, responsable de collecte) et `dossiers.review` (administrateur).

Espaces de travail (`web-app/src/pages/admin/workspaces.js`), adaptés au rôle : Tableau de bord, Collectes, Validations, Communautés, Collecteurs, Médiathèque, Sources et archives, Paramètres pour l'administrateur ; Tableau de bord, Mes collectes et Communautés pour le collecteur. Un espace n'apparaît que si l'utilisateur a accès à l'un de ses onglets.

### Dossiers de collecte
- **Modèle** (migration additive `dossiers_de_collecte`) : `CollectionDossier` (communauté ou communauté proposée, collecteur, statut, contenu JSON des étapes, revues par étape, correspondance avec les fiches publiées, avancement), `DossierEvent` (historique : transitions, revues d'étape, commentaires, corrections de l'administrateur), `DossierVersion` (instantané à chaque soumission, demande de corrections, validation et publication), `DossierSectionDef` (étapes du formulaire). `CulturalItem` reçoit deux colonnes facultatives, `dossierId` et `dossierUnit`, pour la provenance des fiches.
- **Étapes configurables** : les 20 étapes de référence sont définies dans `server-app/src/services/dossierSchema.js` et créées en base au démarrage si elles manquent ; l'administrateur les adapte ou en ajoute (Paramètres › Formulaire de collecte). Types de champs : texte, texte long, liste, choix, date, et pour les témoignages personne, consentement, média, étapes. Une étape peut avoir des **éléments répétables** et une **catégorie de publication**.
- **Contenu** : pour chaque étape, valeurs des champs, statut des champs sans réponse (inconnu, non documenté, à confirmer), éléments répétés, médias et sources (étaye ou contredit), drapeau « sensible », drapeau « non documentée ». Le serveur valide la structure et vérifie que les médias, sources, personnes et consentements référencés existent (et que le collecteur a accès aux médias).
- **Circuit** (`server-app/src/services/dossiers.js`) : le collecteur soumet ; l'administrateur examine par étape (approuver, demander une correction, rejeter), renvoie le dossier, le valide, le publie ou l'archive ; un dossier publié peut être rouvert par l'administrateur. Une étape corrigée ou modifiée depuis son approbation repasse « à examiner » à la soumission suivante. La validation exige que la communauté existe (une communauté proposée est créée ou associée par l'administrateur, avec contrôle des doublons sur le nom et les autres noms).
- **Publication** : chaque étape approuvée produit une fiche, chaque élément répété une fiche à part, dans la catégorie de l'étape ; les champs qui correspondent aux champs spécialisés de la catégorie (ingrédients, instruments…) y sont repris ; les consentements des témoignages rattachés à l'étape sont associés. Les fiches passent par `createItem` / `updateItem` (versions, audit), sont validées avec une décision tracée, puis publiées seulement si `publicationProblems` est vide. Les contenus sensibles restent validés, en accès « Équipe désignée », sans publication. **Nature de l'information** : un événement marqué « Récit traditionnel » est publié comme *tradition orale*, « Hypothèse » comme *hypothèse*, « À confirmer » comme *vérification incomplète* ; un conte, une légende, un récit, un chant, un proverbe, un dicton ou une devinette (étape Langue) comme *tradition orale* ; sinon *sourcé* si une source est associée, *témoignage* si seul un témoignage avec consentement l'étaye. **Patrimoine matériel** : un monument, un objet, un lieu de mémoire ou un site historique (étape Territoire) est publié dans « Patrimoine matériel et archives ». Ces règles alimentent les collections publiques (Archives, Témoignages, Traditions orales). La fiche est attribuée au collecteur. Republier met à jour les mêmes fiches.

### Multilinguisme (§64)
- **Langues** : français (référence), anglais, lingala, swahili. Module maison `web-app/src/i18n/` : `t(clé, variables)`, `tn(clé, n)` pour les pluriels (clés `.one` / `.other`), `locale()` pour les dates. Dictionnaires dans `i18n/locales/` ; une clé absente retombe sur le français.
- **Choix de la langue** : sélecteur dans l'en-tête public, le menu mobile et la barre de l'administration ; mémorisé dans le navigateur (`urithi.langue`) ; à défaut, langue du navigateur. Le changement recharge la page. `<html lang>`, le titre de l'onglet et la mention « Obligatoire » des champs suivent la langue.
- **Messages du serveur** : rédigés en français, traduits côté client lorsqu'ils figurent dans le dictionnaire (clés `server.*`) ; un message composé n'est traduit que pour sa partie connue.
- **Contenus culturels** : ils ne sont **pas traduits automatiquement** (titres, résumés, noms de catégories saisis restent dans la langue de saisie) ; les traductions documentées passent par les transcriptions et traductions.
- **Relecture** : les traductions en **lingala et en swahili doivent être relues par des locuteurs natifs** avant la mise en production.
- **Contrôle** : chaque dictionnaire doit contenir toutes les clés du français, avec les mêmes variables (`{n}`, `{name}`…).

## 12. Décisions et limites connues

| Sujet | Décision ou limite | Suite prévue |
|---|---|---|
| Base de données | SQLite, choisie par le porteur du projet | Passer à PostgreSQL avant l'extension nationale |
| Dérivés audio et vidéo | Non générés : aucun outil de conversion (ffmpeg) installé ; l'original est servi | Ajouter des versions de consultation MP3 et MP4 quand ffmpeg sera disponible |
| Antivirus | Point d'intégration prêt, ClamAV non installé | Installer ClamAV sur le serveur |
| Demandes d'accès en ligne | Non activées : les comptes sont créés par l'administrateur (option prévue au §31) | Possible plus tard |
| Envoi d'e-mails | Aucun : les mots de passe temporaires sont transmis par l'administrateur | Ajouter un service d'envoi |
| Interface | Français, anglais, lingala, swahili (§64) | Faire relire le lingala et le swahili par des locuteurs natifs |
| Importation documentaire | Non développée (§62, « ultérieurement ») | Tout import devra passer par la validation |
| Hébergement de production | Non configuré | Choisir un hébergeur, un nom de domaine et HTTPS ; définir `NODE_ENV=production` |
