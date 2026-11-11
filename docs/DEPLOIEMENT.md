# Déploiement de URITHI (www.urithi.site)

## Environnements

| | Développement (Mac) | Production (serveur 194.34.232.102) |
|---|---|---|
| Base | SQLite (`server-app/data/urithi.db`) | MySQL 8, base `urithi`, utilisateur `urithi` |
| Schéma Prisma | `prisma/schema.prisma` (référence) | `prisma/mysql/schema.prisma` (généré) |
| Migrations | `prisma/migrations` | `prisma/mysql/migrations` |
| Node | celui du Mac | Node 22 isolé : `/opt/urithi/runtime/node` (le Node 20 du système sert aux autres sites) |

## Organisation sur le serveur

```
/opt/urithi/
  app/server-app/    code de l'API (remplacé à chaque déploiement)
  app/web/           interface construite (vite build)
  data/storage/      médias téléversés     ← jamais touché par le déploiement
  data/backups/      sauvegardes quotidiennes (base MySQL et médias)
  runtime/node/      Node 22
  urithi.env         variables d'environnement, dont le mot de passe MySQL
                     (droits 640, propriétaire root:urithi)
```

- **Service :** `systemctl status|restart urithi`. Il tourne sous l'utilisateur système `urithi`, sur le port 4100 (local). Journal : `journalctl -u urithi -f`.
- **Site nginx :** `/etc/nginx/sites-available/urithi.site`. nginx sert l'interface et transmet `/api/` à l'API. Le modèle se trouve dans `deploy/nginx-urithi.site.conf`.

## Déployer

Depuis la racine du projet, sur le Mac :

```bash
./deploy/deploy.sh "message de commit"
```

Le script enchaîne :
1. les tests ;
2. la construction de l'interface ;
3. l'envoi du code ;
4. `npm ci` ;
5. les migrations MySQL ;
6. le redémarrage du service ;
7. la vérification du site ;
8. le commit et l'envoi sur GitHub (`OnlyKal/urithii-system`, branche `main`).

## Modifier le modèle de données

1. Modifier `prisma/schema.prisma`, puis créer la migration SQLite comme d'habitude.
2. Lancer `npm run db:mysql:schema` pour régénérer le schéma MySQL.
3. Produire la migration MySQL, sur le serveur et avec les variables de `urithi.env` :
   ```bash
   npx prisma migrate diff --from-config-datasource --to-schema prisma/mysql/schema.prisma \
     --config prisma.mysql.config.ts --script > migration.sql
   ```
4. Relire ce SQL. Les valeurs par défaut des colonnes LONGTEXT doivent être écrites entre parenthèses, par exemple `DEFAULT ('')`.
5. Le placer dans `prisma/mysql/migrations/<date>_<nom>/migration.sql`.
6. Déployer.

## HTTPS

En production, les cookies de session sont marqués `Secure` : la connexion à l'espace contributeur exige HTTPS. Le certificat Let's Encrypt s'obtient avec :

```bash
certbot --nginx -d urithi.site -d www.urithi.site --redirect
```

## Sauvegardes et restauration

- **Automatique :** une sauvegarde quotidienne, contenant `urithi.sql` (mysqldump) et les médias, avec empreintes SHA-256.
- **Restaurer :**
  ```bash
  mysql urithi < <dossier>/urithi.sql
  ```
  puis recopier `<dossier>/storage/originals` dans `/opt/urithi/data/storage/originals`.

## Premier administrateur

```bash
cd /opt/urithi/app/server-app
set -a; . /opt/urithi/urithi.env; set +a
/opt/urithi/runtime/node/bin/node src/scripts/create-admin.js <email> "<Nom>"
```

Le mot de passe temporaire s'affiche une seule fois. Il devra être changé à la première connexion.
