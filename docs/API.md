# API d'URITHI

L'API est en JSON, servie sous `/api`. Toutes les routes sous `/api/admin` exigent une session et un mot de passe définitif ; les permissions sont vérifiées route par route (voir [CONCEPTION.md §4](CONCEPTION.md)). La session est soit le cookie `urithi_session` du site, soit un jeton d'application envoyé dans l'en-tête `Authorization: Bearer <jeton>` (voir [API_COLLECTEUR.md](API_COLLECTEUR.md)). Avec le cookie, les requêtes qui modifient des données doivent provenir de l'origine du site (`CLIENT_URL`) ; avec un jeton, l'origine n'est pas exigée.

Les erreurs renvoient `{ "error": "message", "details": [...] }` avec les codes : 400 données invalides, 401 non connecté, 403 non autorisé, 404 introuvable (aussi pour ce qui existe mais n'est pas accessible), 409 conflit ou élément relié, 413 fichier trop volumineux, 422 publication impossible (liste des problèmes dans `details`).

## Public (sans compte)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | État du service |
| GET | `/api/public/home` | Statistiques, nouveautés, mises à jour, communautés, thèmes, collections historiques |
| GET | `/api/public/categories` | Thèmes actifs avec nombre de contenus publiés |
| GET | `/api/public/communities?q=&placeId=` | Communautés publiées |
| GET | `/api/public/communities/:slug` | Fiche communauté, contenus et médias publics |
| GET | `/api/public/places` | Lieux avec nombre de communautés et de contenus |
| GET | `/api/public/languages` | Langues ayant des contenus publics |
| GET | `/api/public/items?q=&category=&community=&placeId=&languageId=&mediaKind=&verification=&page=&pageSize=` | Contenus publiés filtrés |
| GET | `/api/public/items/:slug` | Version publiée d'une fiche : médias et sources publics, historique, relations |
| GET | `/api/public/media?kind=&community=&category=&added=month\|year&sort=recent\|oldest\|title&q=` | Médiathèque publique ; chaque média porte ses communautés, thèmes et fiches publiques |
| GET | `/api/public/media/:id` | Page de consultation : média, transcriptions publiques, contexte culturel et médias associés (404 si non diffusable) |
| GET | `/api/public/media/:id/file?variant=web\|thumbnail&download=1` | Fichier public, requêtes partielles (Range) acceptées ; `download=1` n'est honoré que si les droits de diffusion sont confirmés |
| GET | `/api/public/search?q=` | Recherche générale, insensible aux accents |
| GET | `/api/public/export` | Export JSON des contenus publiés |
| POST | `/api/public/takedown-requests` | Signalement ou demande de retrait (limité en débit) |

## Compte
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion du site (cookie ; limitée en débit, verrouillage après 5 échecs) |
| POST | `/api/auth/token` | Jeton d'application (`{ email, password, label? }` → `{ token, tokenType, expiresAt, user }`), valable 30 jours (`API_TOKEN_DAYS`), mêmes protections que la connexion |
| POST | `/api/auth/logout` | Déconnexion (révoque le cookie ou le jeton utilisé) |
| GET | `/api/auth/me` | Utilisateur courant et ses permissions |
| POST | `/api/auth/change-password` | Changement de mot de passe |

## Administration
| Domaine | Routes | Permission |
|---|---|---|
| Tableau de bord | `GET /api/admin/dashboard` (avec `byStatus` et `myByStatus` : nombre de fiches visibles par statut) ; `?scope=counts` ne renvoie que ces compteurs et les signalements ouverts | connecté |
| Listes pour formulaires | `GET /api/admin/lookups` | connecté |
| Lieux | `GET, POST /api/admin/places`, `PATCH, DELETE /api/admin/places/:id` | lecture : connecté ; écriture : `communities.manage` |
| Langues | `/api/admin/languages` (idem) | idem |
| Catégories | `/api/admin/categories` (idem, avec `fieldsSchema`) | écriture : `categories.manage` |
| Communautés | `GET, POST /api/admin/communities`, `GET, PATCH, DELETE /:id`, `POST /import` (fichier JSON, analyse puis import, voir [IMPORT_COMMUNAUTES.md](IMPORT_COMMUNAUTES.md)) | écriture : `communities.manage` |
| Sources | `GET, POST /api/admin/sources`, `GET, PATCH, DELETE /:id` | écriture : `sources.manage` |
| Personnes ressources | `/api/admin/persons` (CRUD) | `persons.manage` |
| Consentements | `/api/admin/consents` (CRUD), `POST /:id/revoke`, `POST, GET /:id/document` | `consents.manage` |
| Médias | `GET, POST (multipart) /api/admin/media`, `GET, PATCH /:id`, `POST /:id/check-integrity`, `GET /:id/file?variant=` | téléversement : `files.upload` |
| Textes | `GET, POST /api/admin/texts`, `GET /:id`, `POST /:id/revisions`, `POST /:id/verify`, `PATCH /:id/visibility` | `transcription.edit`, `translation.edit` ou `content.edit` |
| Fiches | `GET, POST /api/admin/items` (filtres `q`, `status` — un ou plusieurs statuts séparés par des virgules —, `categoryId`, `communityId`, `mine=1`), `GET, PATCH /:id` | création : `content.create` |
| Versions | `GET /api/admin/items/:id/versions/:v`, `POST …/restore` | droit de modification |
| Validation | `POST /api/admin/items/:id/transitions`, `POST /:id/comments` | selon l'étape (voir `services/workflow.js`) |
| Dossiers de collecte | `GET, POST /api/admin/dossiers` (filtres `status`, `mine`, `communityId`, `collectorId`, `q`), `GET /counts`, `GET /stats` (suivi des collecteurs), `GET /similar-communities?name=`, `GET, PATCH /:id`, `GET /:id/versions/:v`, `POST /:id/transitions`, `PUT /:id/reviews/:sectionKey`, `POST /:id/comments`, `POST /:id/community`, `POST /:id/publish` | `dossiers.collect` (ses dossiers) ; revue, communauté, publication et suivi : `dossiers.review` |
| Étapes du formulaire | `GET /api/admin/dossier-sections`, `POST`, `PATCH /:id` | lecture : connecté ; écriture : `dossiers.review` ou `settings.manage` |
| Relations | `POST /api/admin/items/:id/relations`, `DELETE …/:relationId` | droit de modification |
| Accès nominatifs | `POST /api/admin/items/:id/grants`, `DELETE …/:userId` | `content.edit` ou `settings.manage` |
| Missions | `GET, POST /api/admin/missions`, `GET, PATCH /:id`, `/members`, `/persons`, `/questionnaires`, `/notes`, `/reports` | `missions.manage`, `missions.participate` |
| Questionnaires | `GET, POST /api/admin/questionnaires`, `PATCH /:id` | écriture : `missions.manage` |
| Signalements | `GET /api/admin/takedowns`, `GET, PATCH /:id`, `POST /:id/suspend` | `reports.manage` |
| Permissions | `GET /api/admin/settings/permissions`, `PUT, DELETE /:role` | `settings.manage` |
| Conservation | `GET /api/admin/preservation/runs`, `POST /backup`, `POST /restore-test`, `POST /integrity-check` | `backups.manage` |
| Export complet | `GET /api/admin/preservation/export` | `export.full` |
| Utilisateurs | `GET, POST /api/users`, `PATCH /:id`, `POST /:id/deactivate · reactivate · reset-password · revoke-sessions` | `users.manage` |
| Journal d'audit | `GET /api/audit`, `GET /api/audit/verify` | `audit.read` |
