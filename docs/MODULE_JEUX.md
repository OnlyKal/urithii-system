# Module Jeux : « URITHI – Les Gardiens de l'Héritage »

Jeu d'aventure et d'exploration en 3D, dans le navigateur, qui fait découvrir le patrimoine naturel et culturel de la RDC à partir des contenus documentés d'URITHI.

## 1. Principes

- **Une seule source documentaire.** Le jeu ne rédige pas sa propre documentation :
  - la faune et la flore sont les fiches de l'atlas vivant (`web-app/src/data/atlasContent.js`) ;
  - la culture, ce sont les fiches publiées, lues par l'API publique (`/api/public/items?category=…`).
- **Toute la plateforme, présente et à venir.** Le jeu lit au lancement le registre de la plateforme (`core/platform.js`) : référentiel des catégories, communautés, langues et provinces publiées. Ce qui est publié plus tard apparaît sans toucher au code (voir § 2 bis).
- **Statut affiché tel quel.** Une fiche culturelle incomplète ou en cours de vérification est signalée comme telle.
- **Décor et personnages fictifs, données réelles.** Le village et les personnages sont des décors de démonstration, présentés comme tels. Ils ne représentent aucune communauté. Ce que disent les personnages est cité depuis les fiches, avec un lien vers la source.
- **Sources des quiz.** Chaque question cite la fiche qui fonde sa réponse. L'administration l'impose.
- **Pas de compte, pas de donnée personnelle.**
  - La progression est sauvegardée dans le navigateur (`localStorage`).
  - Le serveur ne reçoit que des compteurs anonymes, agrégés par jour.

## 2. Parcours

| Adresse | Contenu |
|---|---|
| `/jeux` | Accueil : bannière 3D, Commencer et Continuer, modes de jeu, missions, badges, trophées, statistiques, historique des découvertes |
| `/jeux/gardiens` | La partie, en plein écran, hors de la mise en page du site |
| `/jeux/defi` | Mode Défis, 60 secondes : « défi photo » (photographies de l'atlas) ou « défi des savoirs » (questions générées à partir des fiches publiées et de l'atlas) |
| `/admin/jeux/missions` | Missions : création, modification, étapes, quiz, récompenses, publication |
| `/admin/jeux/statistiques` | Statistiques d'utilisation anonymes |

L'entrée « Jeux » figure dans le menu principal, le menu mobile et le pied de page.

## 2 bis. Couverture de la plateforme

| Information de la plateforme | Où dans le jeu | Source | Contenus à venir |
|---|---|---|---|
| Catégories du référentiel (15 thèmes) | Un espace par catégorie racine dans le village. Cinq ont un décor propre (foyer, étoffes, mémoire, paroles, atelier), rattachés par le **code** du référentiel (D, I, B, C, J). Les autres occupent les emplacements libres (`STATION_SLOTS`, 25 places). | `/api/public/categories` | Une nouvelle catégorie racine obtient son espace automatiquement ; au-delà des emplacements, elle reste accessible dans la maison des savoirs. |
| Tous les thèmes et leurs effectifs | La maison des savoirs | `/api/public/categories` | Oui |
| Fiches culturelles complètes | Fiche lue dans le jeu : résumé, texte, champs du référentiel, photos, sons et vidéos, sources, récit, fiches liées | `/api/public/items`, `/api/public/items/:slug` | Oui |
| Communautés (noms, lieux, langues, histoire, fiches, médias) | L'arbre à palabres | `/api/public/communities`, `/api/public/communities/:slug` | Oui |
| Provinces et lieux | L'arbre à palabres, onglet Provinces (fiches de la province et de ses subdivisions) | `/api/public/places` | Oui |
| Langues | L'arbre à palabres, onglet Langues, et la place des paroles | `/api/public/languages` | Oui |
| Médiathèque | La case des sons et des images (lecture dans le jeu) | `/api/public/media` | Oui |
| Atlas vivant : faune et flore | Espèces modélisées (7) ; pour les autres fiches, une borne d'observation en forêt ou en lisière (`TRACES`) | `atlasContent.js` | Une fiche ajoutée à l'atlas reçoit sa borne automatiquement. |
| Atlas vivant : eaux, reliefs, barrages | La longue-vue du belvédère | `atlasContent.js` | Oui |
| Quiz | Missions (écrits par l'administration) et questions générées (personnages hors mission, défi des savoirs) | Fiches publiées et atlas (`core/quizGen.js`) | Les nouvelles fiches enrichissent les questions générées. |

Les questions générées ne portent que sur des données présentes dans les fiches (thème, communauté, province, nom scientifique, statut UICN, rubrique de l'atlas). Les mauvaises réponses sont d'autres valeurs réelles de la plateforme. Chaque question cite sa fiche.

## 3. Architecture

```
web-app/src/games/
  core/       logique sans 3D : progression (sauvegarde), moteur de missions,
              récompenses (niveaux, badges, trophées), contenus URITHI, services API
  engine/     moteur 3D : scène, chargement par étapes, joueur et caméra,
              commandes (clavier, souris, tactile), qualité graphique
  models/     modèles 3D procéduraux : personnages articulés, animaux, végétation,
              habitations
  world/ituri/  premier environnement :
              catalog.js    description sans 3D (zones, espèces, personnages, espaces),
                            lue aussi par l'administration
              terrain.js    relief, rivière, pont, sentiers
              layout.js     placement de la végétation et des collisions
              Landscape, Inhabitants, Atmosphere : composants 3D
  audio/      ambiance sonore synthétisée (forêt, rivière, oiseaux, pas, signaux)
  ui/         interface de jeu : affichage tête haute, mini-carte, carte, journal,
              inventaire, fiches, dialogues, quiz, récompenses, commandes tactiles
  pages/      accueil, partie, défi éclair
  admin/      pages d'administration
server-app/
  prisma : GameMission, GameStat (migration 20261110120000_module_jeux)
  src/data/gameMissions.js     missions fournies, créées au démarrage si absentes
  src/services/games.js        validation (Zod) et mise en forme
  src/routes/admin/games.js    /api/admin/games/*  (permission games.manage)
  src/routes/publicGames.js    /api/public/games/* (missions publiées, compteurs)
```

**Technologies.**
- Three.js, React Three Fiber et Drei (ciel, particules, suivi des performances).
- Aucun fichier 3D, texture ou son externe : tout est généré par le code. L'environnement reste donc léger.
- Un modèle glTF issu de Blender peut remplacer un composant de `models/` sans toucher au reste.

**Performance.**
- Le code 3D n'est téléchargé qu'à l'ouverture d'une page de jeu.
- Le monde est construit par étapes, avec un écran de chargement qui suit la progression réelle.
- La végétation est dessinée en instances : un appel de rendu par espèce.
- Trois niveaux de qualité (densité, ombres, résolution) sont choisis selon l'appareil et modifiables dans le menu Pause. La résolution baisse automatiquement si l'image ralentit.

## 3 bis. Pack HD (modèles réalistes)

En qualité « Haute », le jeu remplace les modèles stylisés par des modèles réalistes produits dans Blender. Les autres qualités gardent les modèles légers générés par le code.

- **Contenu** : arbres géants (limbali), cases rondes, maisons, greniers, okapi, éléphant de forêt, paon du Congo, écogarde, Amani (guide), joueur et joueuse. Environ 25 Mo, dans `web-app/public/games/hd/`, téléchargés seulement en qualité « Haute ».
- **Production** : scripts Blender reproductibles dans `game-assets/blender/` ; `export_web.py` allège l'arbre et copie le pack. Les ressources sources (Poly Haven, MakeHuman, toutes en CC0) sont dans `game-assets/sources/`, avec leurs crédits.
- **Code** : `web-app/src/games/hd/` : chargement (`assets.js`), modèles (`HdModels.jsx`), fourrure en coques (`fur.js`), crédits (`credits.js`, affichés dans le menu Pause).
- **Repli** : chaque modèle HD s'affiche dès qu'il est chargé ; pendant le chargement, ou si un fichier manque, le modèle stylisé reste affiché.
- **Personnages** : animations « repos », « marche », « course », « parole » ; expressions (cibles de morphose) « clignement » (aléatoire), « parole » (pendant les dialogues), « sourire » (face au joueur). Choix de l'avatar (explorateur ou exploratrice) au démarrage.
- **Fourrure et cheveux courts** : longueur stockée dans l'alpha de la texture couleur, réglages dans les extras glTF du matériau (`urithi_fourrure`) ; le jeu superpose jusqu'à 10 coques.
- **Licences** : uniquement CC0 ou CC BY (jamais NC ni ND), URITHI pouvant être monétisé.

## 4. Missions

Une mission comprend :
- un identifiant, un titre, une description et un objectif ;
- un mode et un environnement ;
- des étapes ordonnées ;
- une récompense (XP et badge) ;
- les fiches associées et une communauté facultative ;
- un statut : brouillon, publiée ou désactivée.

Types d'étapes :

| Type | Cibles |
|---|---|
| `explore` | Zones |
| `identify` | Plantes, ou `atlas-flore` (toute plante de l'atlas) |
| `discover` | Animaux et paysages ; groupes `atlas-faune`, `atlas-eaux`, `atlas-reliefs`, `atlas-barrages` |
| `talk` | Personnages |
| `consult` | Espaces du village, y compris ceux créés à partir du référentiel (`theme-<slug>`) |
| `read` | Fiches culturelles lues : `toutes`, `categorie-<slug>` (toute la branche), `communaute-<slug>` |
| `community` | Communautés rencontrées : `toutes` ou un slug |
| `quiz` | Personnage qui pose les questions |

Une cible « groupe » peut compter plusieurs fois : « lire trois fiches de gastronomie » vaut pour toutes les fiches publiées, y compris celles publiées plus tard. L'avancement se déduit de ce que le joueur a déjà fait : une espèce découverte compte pour toutes les missions qui la demandent.

Missions fournies :
1. **Premiers pas dans l'Ituri** (exploration)
2. **Les secrets de la forêt** (nature) : la mission d'exemple du cahier des charges
3. **Gardiens de la faune** (nature)
4. **Les savoirs du village** (patrimoine culturel)
5. **Le panorama du Congo** (exploration) : longue-vue du belvédère
6. **Les voix des communautés** (patrimoine culturel) : créée en brouillon, à publier quand des communautés et des fiches sont publiées

## 5. Ajouter un contenu

- **Une mission dans l'environnement existant** : depuis l'administration, sans écrire de code.
- **Une fiche culturelle, une communauté, une langue, une catégorie** : rien à faire, il suffit de les publier dans la plateforme.
- **Une espèce** : ajouter sa fiche à l'atlas, avec sa photographie et son crédit. Elle apparaît dans le jeu sous forme de borne d'observation. Pour lui donner un modèle 3D :
  1. L'ajouter à `SUBJECTS` dans `world/ituri/catalog.js`.
  2. Pour un animal, ajouter son modèle dans `models/animals.jsx`.
- **Un environnement** (une autre région) : créer `world/<id>/` sur le modèle de `world/ituri/` (catalogue, relief, composants), puis l'enregistrer dans `ENVIRONMENTS`. Les missions le désignent par son identifiant.
- **Le mode Histoire et mémoire** : il est annoncé « en préparation ». Il ne sera ouvert qu'avec des récits et des archives validés par les historiens et les communautés.

## 6. Commandes

- Déplacement : Z Q S D, W A S D ou les flèches.
- Course : Maj. Saut : Espace.
- Interaction : E. Carte, journal et inventaire : M, J et I.
- Caméra : glisser pour la tourner, molette pour le zoom.
- Pause : Échap.
- Sur écran tactile : manette virtuelle et boutons d'action.

## 7. Tests

- `server-app/test/games.test.js` :
  - création unique des missions fournies ;
  - permission `games.manage` ;
  - publication ;
  - validation des étapes et des quiz ;
  - protection des missions fournies ;
  - statistiques.
- Parcours vérifiés dans un navigateur (Playwright) :
  - nouvelle partie, déplacements, dialogue, espace culturel avec de vraies fiches publiées ;
  - identification d'une plante, observation d'animaux, carte, journal, inventaire ;
  - mission complète avec quiz, écran de récompense et badge ;
  - défi éclair ;
  - administration (liste, modification, création, statistiques).
