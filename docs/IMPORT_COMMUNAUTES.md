# Importer des communautés depuis un fichier JSON

**Où :** Communautés › **Importer (JSON)** (administrateur, permission `communities.manage`).

## Déroulement
1. **Télécharger un modèle** (facultatif) : un fichier d'exemple qui montre la structure, sans aucune donnée culturelle.
2. Choisir le fichier `.json`.
3. Choisir le traitement des communautés qui existent déjà :
   - **L'ignorer** (par défaut) ;
   - **La compléter** : les champs vides sont remplis, et les noms, lieux et langues manquants sont ajoutés. **Rien n'est effacé ni remplacé.**
4. **Analyser** : le tableau montre, pour chaque entrée, ce qui sera fait (à créer, à compléter, ignorée, en erreur) et les remarques. Les remarques signalent par exemple un lieu inconnu, un lieu ambigu ou un doublon dans le fichier. **L'analyse n'enregistre rien.**
5. **Importer** : les opérations sont appliquées. Une entrée en erreur n'empêche pas les autres.

## Règles
- **Pas de doublon** : une communauté est reconnue par son nom ou l'un de ses autres noms, en ignorant les accents et les majuscules (« HAVU » = « Havu »). Deux entrées du même fichier qui désignent la même communauté sont refusées.
- **Pas de publication automatique** : une communauté importée est créée non publiée. La case « Afficher cette communauté sur le site public » reste à cocher après vérification.
- **Lieux et langues existants uniquement** : ils sont recherchés par leur nom (ou par leur code ISO pour une langue). Un lieu ou une langue introuvable est signalé et ignoré, jamais créé. Si plusieurs lieux portent le même nom, précisez `type` ou `parent`.
- **Traçabilité** : chaque communauté créée ou complétée est inscrite au journal d'audit, ainsi que l'import lui-même (« Import de communautés »).
- **Limites** : 500 communautés par fichier, 10 Mo.
- N'importez que des informations sourcées : **aucune donnée ne doit être inventée** pour remplir un champ.

## Format

Le fichier est soit une liste, soit un objet `{ "communities": [ … ] }`.

```json
{
  "communities": [
    {
      "name": "Nom principal",
      "otherNames": ["Autre nom", { "name": "Nom historique", "kind": "HISTORICAL", "notes": "Précision" }],
      "summary": "Résumé",
      "description": "Présentation générale",
      "history": "Éléments historiques",
      "documentationStatus": "IN_PROGRESS",
      "documentationNote": "Note sur la documentation",
      "places": ["Idjwi", { "name": "Kalehe", "type": "TERRITORY", "parent": "Sud-Kivu" }],
      "languages": ["Kihavu", { "isoCode": "hav" }]
    }
  ]
}
```

| Champ | Obligatoire | Valeurs |
|---|---|---|
| `name` | oui | Nom principal (200 caractères au plus) |
| `otherNames` | non | Liste de noms (texte), ou d'objets `{ name, kind, notes }`. `kind` : `AUTONYM` (autodésignation), `EXONYM` (nom extérieur), `HISTORICAL` (nom historique), `VARIANT` (par défaut) |
| `summary`, `description`, `history` | non | Texte |
| `documentationStatus` | non | `NOT_STARTED`, `IN_PROGRESS`, `PARTIAL`, `ADVANCED` |
| `documentationNote` | non | Texte |
| `places` | non | Noms de lieux existants (texte), ou objets `{ name, type, parent, notes }`. `type` : `COUNTRY`, `PROVINCE`, `TERRITORY`, `CITY`, `COMMUNE`, `CHIEFDOM`, `LOCALITY`, `VILLAGE`, `OTHER` |
| `languages` | non | Noms de langues existantes (texte), ou objets `{ name, isoCode, notes }` |

API : `POST /api/admin/communities/import` avec `{ "data": <contenu du fichier>, "mode": "skip" | "update", "dryRun": true | false }`. La réponse contient `counts` (create, update, skip, error) et `results` (une ligne par entrée).
