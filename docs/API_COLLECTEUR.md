# API collecteur d'URITHI

Cette API permet à une application de collecte (application mobile, outil de terrain, script) de faire ce que fait un collecteur sur le site :
- créer ses dossiers de collecte, les remplir et y joindre des fichiers ;
- enregistrer des sources et des personnes ressources ;
- soumettre ses dossiers à la vérification et suivre les retours.

Ce sont les mêmes routes que celles du site. Les mêmes règles et les mêmes droits s'appliquent : un compte collecteur ne voit que ses propres dossiers et ne peut ni valider ni publier. La liste complète des routes est dans [API.md](API.md).

## 1. Principes

- **Adresse** : `https://<serveur>/api` (en local : `http://localhost:4000/api`). En production, utilisez **uniquement HTTPS** : le jeton donne accès au compte.
- **Format** : JSON (`Content-Type: application/json`), sauf pour l'envoi des fichiers (`multipart/form-data`).
- **Erreurs** : `{ "error": "message lisible", "details": [{ "field": "…", "message": "…" }] }`.

| Code | Signification |
|---|---|
| 400 | Données invalides |
| 401 | Jeton absent, inconnu, expiré ou révoqué |
| 403 | Action non autorisée pour ce compte, ou mot de passe temporaire à changer |
| 404 | Introuvable ou non accessible |
| 409 | Conflit, par exemple une communauté qui existe déjà |
| 413 | Fichier trop volumineux |
| 429 | Trop de tentatives de connexion |

## 2. Authentification par jeton

### Obtenir un jeton
```http
POST /api/auth/token
Content-Type: application/json

{ "email": "collecteur@exemple.cd", "password": "••••••••", "label": "Téléphone de Mama K." }
```
`label` est facultatif. Il apparaît dans le journal d'audit et aide à reconnaître l'appareil.

Réponse `201` :
```json
{
  "token": "pZ3…",
  "tokenType": "Bearer",
  "expiresAt": "2026-11-26T10:00:00.000Z",
  "user": { "id": "…", "email": "…", "displayName": "…", "roles": ["COLLECTEUR"], "permissions": ["dossiers.collect", "files.upload", "…"], "mustChangePassword": false }
}
```

Envoyez ensuite le jeton dans **chaque** requête :
```http
Authorization: Bearer pZ3…
```

### Règles
- **Durée de validité** : 30 jours par défaut (réglage `API_TOKEN_DAYS`). À l'expiration, l'application redemande l'identifiant et le mot de passe.
- **Protections** : les mêmes règles que la connexion du site s'appliquent.
  - Le nombre de tentatives est limité.
  - Le compte est verrouillé 15 minutes après 5 échecs.
  - Un compte désactivé ne peut pas obtenir de jeton.
- **Mot de passe temporaire** : si `user.mustChangePassword` vaut `true`, les autres routes répondent `403` tant que le mot de passe n'est pas changé. Pour le changer : `POST /api/auth/change-password` avec `{ "currentPassword", "newPassword" }` (12 caractères minimum).
- **Déconnexion** : `POST /api/auth/logout` révoque le jeton utilisé.
- **Révocation par l'administrateur** :
  - désactiver le compte suspend aussitôt tous ses jetons ;
  - « fermer les sessions » (`POST /api/users/:id/revoke-sessions`) les révoque ;
  - changer le mot de passe révoque aussi les jetons, sauf celui qui sert au changement.
- **Stockage** : gardez le jeton dans le stockage sécurisé de l'appareil (Keychain, Keystore), jamais dans un fichier lisible.
- **Origine** : une requête avec jeton n'a pas besoin d'en-tête `Origin`. Une application **web** hébergée ailleurs que le site doit être autorisée côté serveur (`API_ALLOWED_ORIGINS`). Une application mobile ou un script n'en a pas besoin.

### Vérifier le compte
`GET /api/auth/me` renvoie l'utilisateur et ses permissions.

## 3. Données de référence

| Requête | Contenu |
|---|---|
| `GET /api/admin/lookups` | Communautés (`id`, `name`), lieux (`id`, `name`, `type`, `parentId`), langues, catégories, questionnaires |
| `GET /api/admin/dossier-sections` | Le formulaire de collecte : étapes (`key`, `title`, `kind`), leurs champs (`fields`) et, pour les étapes à éléments multiples (plats, danses…), le modèle d'élément (`entry`, avec son champ titre `titleField`) |
| `GET /api/admin/dossiers/similar-communities?name=` | Communautés proches d'un nom proposé, à vérifier avant d'en proposer une nouvelle |
| `GET /api/admin/missions` | Missions auxquelles le collecteur participe |

Construisez le formulaire de l'application à partir de `dossier-sections`, plutôt que de le coder en dur : les administrateurs peuvent ajouter des étapes ou des champs.

## 4. Dossiers de collecte

| Requête | Rôle |
|---|---|
| `GET /api/admin/dossiers?status=&q=&page=&pageSize=` | Mes dossiers (`total`, `dossiers`) |
| `GET /api/admin/dossiers/counts` | Nombre de mes dossiers par statut |
| `POST /api/admin/dossiers` | Créer : `{ "communityId": "…", "title": "…", "missionId": "…" }`. Pour une communauté absente de la liste, envoyez `proposedCommunityName` à la place de `communityId` |
| `GET /api/admin/dossiers/:id` | Dossier complet, avec les revues par étape et l'historique |
| `PATCH /api/admin/dossiers/:id` | Enregistrer : `{ "data": { "sections": { … } } }` et/ou `title`, `communityId`, `missionId` |
| `POST /api/admin/dossiers/:id/transitions` | Soumettre : `{ "toStatus": "SUBMITTED" }` |
| `POST /api/admin/dossiers/:id/comments` | Répondre à une remarque : `{ "comment": "…", "sectionKey": "gastronomie" }` |

### Contenu d'un dossier (`data`)
```json
{
  "sections": {
    "identification": {
      "values": { "presentation": "Texte recueilli…" },
      "fieldStatus": { "origineNom": "UNKNOWN" },
      "media": [{ "mediaId": "…", "caption": "Le village au lever du jour" }],
      "sources": [{ "sourceId": "…", "supports": "Origine du nom", "locator": "p. 12" }]
    },
    "gastronomie": {
      "values": { "habitudes": "…" },
      "entries": [
        { "id": "plat-1", "values": { "nom": "Liboke", "ingredients": ["poisson", "feuilles de manioc"] }, "media": [{ "mediaId": "…" }] },
        { "id": "plat-2", "values": { "nom": "Plat réservé" }, "sensitive": true }
      ]
    }
  }
}
```

**Les clés :**
- **`sections`** : les clés sont les `key` des étapes du formulaire. Une clé inconnue est refusée.
- **`values`** :
  - les clés sont les `key` des champs de l'étape ;
  - une valeur est un texte, ou une liste de textes pour les champs de type `list`.
- **`fieldStatus`** : marque un champ comme `UNKNOWN` (inconnu), `UNDOCUMENTED` (non documenté) ou `TO_CONFIRM` (à confirmer).
- **`entries`** : les éléments d'une étape à éléments multiples.
  - Chacun a un `id` choisi par l'application et ses `values`.
  - Le champ titre (`entry.titleField`) est obligatoire pour soumettre.
- **`media`**, **`sources`** : des références à des fichiers et sources déjà enregistrés (voir plus bas). Une référence inconnue est refusée.
- **`sensitive: true`** : l'élément ou l'étape n'est pas publié ; il reste réservé à l'équipe.

**Règles :**
- `PATCH` remplace tout le contenu `data` : envoyez toujours le dossier complet.
- L'enregistrement n'est possible qu'aux statuts **Brouillon**, **En cours** et **Corrections demandées**.

### Statuts
`DRAFT` → `IN_PROGRESS` → `SUBMITTED` → `UNDER_REVIEW` → `VALIDATED` → `PUBLISHED`, avec `CHANGES_REQUESTED` quand l'équipe demande des corrections.

Le collecteur ne fait qu'une transition : **`SUBMITTED`**. Elle est possible depuis Brouillon, En cours ou Corrections demandées, et demande au moins une étape renseignée. Les corrections demandées se lisent dans `reviews` (une entrée par étape : `status`, `comment`) et dans l'historique du dossier.

## 5. Fichiers (photos, sons, vidéos, documents)

```http
POST /api/admin/media
Authorization: Bearer …
Content-Type: multipart/form-data

file=<le fichier>
title=Danse de la récolte
description=…
accessLevel=PRIVATE            (PRIVATE par défaut ; PUBLIC, CONTRIBUTORS, TEAM, SPECIAL)
dateKind=EXACT  dateValue=2026-10-12
placeId=…  missionId=…  context=…  provenance=…  collectedAt=2026-10-12T09:30:00Z
```
Réponse `201` : `{ "media": { "id": "…", "kind": "PHOTO|AUDIO|VIDEO|DOCUMENT", … } }`. Utilisez ensuite `id` dans `media` du dossier.

**Formats acceptés**, choisis pour être lus par tous les navigateurs :
- photo : JPEG, PNG, WebP, TIFF ;
- son : MP3, WAV, M4A ;
- vidéo : **MP4 encodé en H.264** ;
- document : PDF, TXT.

**Ce que le serveur vérifie :**
- Il contrôle le vrai contenu du fichier, pas seulement son extension.
- Un MP4 en HEVC, ce que produisent souvent les iPhone récents, est refusé : convertissez-le en H.264 sur l'appareil avant l'envoi.
- La taille maximale est de 2 Go par fichier (réglage `MAX_UPLOAD_MB`).

**Autres routes :**
- `GET /api/admin/media?q=&kind=` : mes fichiers.
- `GET /api/admin/media/:id` : la fiche d'un fichier.
- `PATCH /api/admin/media/:id` : modifier les informations.

## 6. Sources et personnes ressources

| Requête | Rôle |
|---|---|
| `GET, POST /api/admin/sources`, `GET, PATCH /:id` | Sources : `{ "type": "FIELDWORK", "title": "Entretien avec …, 12/10/2026", "author", "date", "reference", "url", "notes" }` |
| `GET, POST /api/admin/persons`, `GET, PATCH /:id` | Personnes ressources : `{ "fullName", "publicName", "attributionMode": "NAME\|PSEUDONYM\|ANONYMOUS", "communityId", "locality", "contact", "isMinor", "guardianName" }` |

Les informations personnelles (nom réel, contact) ne sont jamais publiées. Seul le nom choisi selon `attributionMode` peut apparaître.

## 7. Exemple complet (curl)

```sh
API=http://localhost:4000/api
TOKEN=$(curl -s -X POST $API/auth/token -H 'Content-Type: application/json' \
  -d '{"email":"collecteur@exemple.cd","password":"••••••••","label":"essai"}' | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"

curl -s $API/admin/dossier-sections -H "$AUTH" | jq '.sections[] | {key, title}'
COMMUNITY=$(curl -s $API/admin/lookups -H "$AUTH" | jq -r '.communities[] | select(.name=="Havu") | .id')

DOSSIER=$(curl -s -X POST $API/admin/dossiers -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"communityId\":\"$COMMUNITY\",\"title\":\"Collecte d'octobre\"}" | jq -r .dossier.id)

MEDIA=$(curl -s -X POST $API/admin/media -H "$AUTH" -F file=@photo.jpg -F title='Le marché' | jq -r .media.id)

curl -s -X PATCH $API/admin/dossiers/$DOSSIER -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"data\":{\"sections\":{\"identification\":{\"values\":{\"presentation\":\"…\"},\"media\":[{\"mediaId\":\"$MEDIA\"}]}}}}"

curl -s -X POST $API/admin/dossiers/$DOSSIER/transitions -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"toStatus":"SUBMITTED"}'

curl -s -X POST $API/auth/logout -H "$AUTH"
```

## 8. Réglages du serveur

| Variable | Rôle | Par défaut |
|---|---|---|
| `API_TOKEN_DAYS` | Durée de validité d'un jeton | 30 |
| `API_ALLOWED_ORIGINS` | Applications web externes autorisées (CORS), séparées par des virgules | aucune |
| `MAX_UPLOAD_MB` | Taille maximale d'un fichier | 2048 |
