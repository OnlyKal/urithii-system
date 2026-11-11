# Passage à PostgreSQL (préparation de la phase 8)

SQLite convient au prototype et au pilote Havu. Avant l'extension nationale (§85), il est recommandé de passer à PostgreSQL pour :
- les écritures simultanées de nombreux contributeurs ;
- une recherche plein texte plus riche (`unaccent`, `tsvector`, recherche par similarité) ;
- les sauvegardes à chaud et la réplication ;
- l'hébergement sur un service géré.

L'architecture a été pensée pour que ce passage n'exige **aucune reconstruction** : tout l'accès aux données passe par Prisma, et la recherche repose sur un champ `searchText` normalisé, indépendant du moteur.

## Étapes
1. Installer PostgreSQL (16 ou plus récent) et créer une base `urithi`.
2. Installer l'adaptateur : `npm install @prisma/adapter-pg@7 pg`.
3. Dans `prisma/schema.prisma`, remplacer `provider = "sqlite"` par `provider = "postgresql"`.
4. Dans `src/db.js`, remplacer `PrismaBetterSqlite3` par `PrismaPg` (`new PrismaPg({ connectionString: process.env.DATABASE_URL })`).
5. Générer une nouvelle migration initiale PostgreSQL dans un dossier de migrations distinct, puis l'appliquer : `npx prisma migrate deploy`.
6. **Transférer les données** à partir de l'export complet (**Conservation → Export complet**), avec un script d'import qui respecte l'ordre des clés étrangères. Ce script est à écrire au moment de la migration.
7. Copier le dossier `storage/` tel quel : les fichiers ne dépendent pas de la base.
8. Adapter `services/backup.js` : remplacer la copie SQLite par `pg_dump --format=custom`, et le test de restauration par `pg_restore` vers une base temporaire.
9. Lancer `npm test` sur une base PostgreSQL de test, puis vérifier le journal d'audit (`/api/audit/verify`) et l'intégrité des fichiers après la migration.

## Points d'attention
- Les énumérations deviendront de vrais types contrôlés par la base, ce qui est un gain.
- Les champs JSON stockés en texte pourront être convertis en `jsonb`.
- Les recherches `contains` deviennent sensibles à la casse sous PostgreSQL. Comme `searchText` est déjà normalisé en minuscules et sans accents, la recherche publique n'est pas affectée. En revanche, les recherches de l'administration sur les titres devront utiliser `mode: 'insensitive'`.
- Pour les médias volumineux, prévoir en parallèle un stockage objet compatible S3, avec réplication. Le service `services/storage.js` est le seul endroit à adapter.
