# URITHI

Plateforme web de documentation, de préservation et de transmission du patrimoine culturel de la République démocratique du Congo. *Urithi* signifie « héritage » en swahili.

## Documentation
| Document | Contenu |
|---|---|
| [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md) | Cahier des charges de référence |
| [docs/CONCEPTION.md](docs/CONCEPTION.md) | Architecture, règles métier, sécurité, avancement, limites |
| [GUIDE.md](GUIDE.md) | Guide pas à pas : de la collecte à la publication (scénario complet) |
| [docs/GUIDE_ADMINISTRATION.md](docs/GUIDE_ADMINISTRATION.md) | Utilisation de l'espace contributeur |
| [docs/API.md](docs/API.md) | Routes de l'API |
| [docs/IMPORT_COMMUNAUTES.md](docs/IMPORT_COMMUNAUTES.md) | Import de communautés depuis un fichier JSON |
| [docs/TESTS.md](docs/TESTS.md) | Tests et résultats |
| [docs/MIGRATION_POSTGRESQL.md](docs/MIGRATION_POSTGRESQL.md) | Préparation de l'extension nationale |
| [docs/editorial/](docs/editorial/README.md) | Protocole de collecte, guides, formulaire de consentement, politiques, modèles, pilote Havu |

## Structure
| Dossier | Rôle | Port |
|---|---|---|
| `server-app/` | API Node.js (Express, Prisma, SQLite) | 4000 |
| `web-app/` | Site public et espace contributeur (React, Vite) | 5180 |

## Prérequis
Node.js 22.18 ou plus récent.

## Installation
```bash
npm run install:all                      # installe les deux applications
cd server-app
cp .env.example .env                     # puis ajuster si besoin
npm run db:deploy                        # crée ou met à jour la base SQLite (data/urithi.db)
npm run seed                             # catégories, provinces, questionnaire, dossier Havu (sans doublons)
npm run create-admin -- vous@exemple.cd "Votre nom"
```
La dernière commande affiche un **mot de passe temporaire**, à changer à la première connexion.

## Lancement en développement
Dans deux terminaux, depuis la racine du projet :
```bash
npm run dev:server    # http://localhost:4000
npm run dev:web       # http://localhost:5180
```
Site public : http://localhost:5180 — espace contributeur : http://localhost:5180/connexion

## Variables d'environnement (`server-app/.env`)
| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `4000` | Port de l'API |
| `CLIENT_URL` | `http://localhost:5180` | Origine autorisée du site (CORS et contrôle d'origine) |
| `DATABASE_URL` | `file:./data/urithi.db` | Base SQLite |
| `STORAGE_DIR` | `./storage` | Fichiers originaux et dérivés, **hors** de tout dossier public |
| `BACKUP_DIR` | `./backups` | Sauvegardes |
| `BACKUP_MIRROR_DIR` | — | Second emplacement de copie (disque externe, serveur distant) |
| `AUTO_BACKUP_HOURS` | `24` | Fréquence des sauvegardes automatiques (`0` pour les désactiver) |
| `MAX_UPLOAD_MB` | `2048` | Taille maximale d'un fichier téléversé |
| `CLAMSCAN_PATH` | — | Chemin de `clamscan` pour l'analyse antivirus |
| `NODE_ENV` | — | `production` active les cookies `Secure` |

Pour le site web (`web-app`), `WEB_PORT` et `API_URL` permettent de changer le port et l'adresse de l'API en développement.

Ne versionnez jamais `.env`, `data/`, `storage/` ni `backups/`.

## Commandes (`server-app`)
| Commande | Effet |
|---|---|
| `npm test` | Tests automatisés sur une base jetable |
| `npm run db:migrate` | Crée et applique une migration après modification du schéma |
| `npm run db:deploy` | Applique les migrations existantes, sans perte de données |
| `npm run seed` | Données de référence (peut être relancé sans risque) |
| `npm run create-admin -- <email> "<nom>"` | Crée un super administrateur |
| `npm run backup` | Sauvegarde complète : base, fichiers et manifeste d'empreintes |
| `npm run backup:verify -- <dossier>` | Vérifie qu'une sauvegarde est intacte |
| `npm run backup:restore-test [-- <dossier>]` | Test de restauration (la dernière sauvegarde par défaut) |
| `npm run integrity-check` | Contrôle des empreintes de tous les fichiers conservés |
| `npm run restore -- <dossier> --confirm` | Restauration réelle, **serveur arrêté**. Les données actuelles sont déplacées à côté, jamais supprimées |

## Mise en production (à préparer)
- Construire le site : `cd web-app && npm run build`, puis servir `web-app/dist` derrière un serveur web (Nginx, Caddy) qui redirige `/api` vers le serveur Node.
- HTTPS obligatoire, `NODE_ENV=production`, `CLIENT_URL` égal au nom de domaine.
- Sauvegardes vers au moins deux emplacements distincts, et un test de restauration mensuel.
- Avant l'extension nationale : passage à PostgreSQL ([guide](docs/MIGRATION_POSTGRESQL.md)).
