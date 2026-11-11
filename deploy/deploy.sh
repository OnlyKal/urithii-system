#!/usr/bin/env bash
# Déploiement de URITHI sur www.urithi.site, puis envoi du code sur GitHub.
# Usage (depuis la racine du projet) : ./deploy/deploy.sh "message de commit"
#
# Étapes :
#   1. tests de l'API et construction de l'interface ;
#   2. envoi du code sur le serveur (rsync) ; les données, les médias,
#      les sauvegardes et le fichier d'environnement ne sont jamais touchés ;
#   3. dépendances, migrations MySQL, redémarrage du service ;
#   4. vérification que le site et l'API répondent ;
#   5. commit et envoi sur GitHub (OnlyKal/urithii-system, branche main).
set -euo pipefail

HOST="${URITHI_HOST:-root@194.34.232.102}"
KEY="${URITHI_SSH_KEY:-$HOME/.ssh/id_ed25519_urithi_deploy}"
SITE="https://www.urithi.site"
MESSAGE="${1:-Déploiement du $(date '+%Y-%m-%d %H:%M')}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes "$HOST")
RSYNC_SSH="ssh -i $KEY -o IdentitiesOnly=yes"

cd "$ROOT"
echo "== 1. Tests et construction"
(cd server-app && npm test >/tmp/urithi-tests.log 2>&1) || { echo "Tests en échec : voir /tmp/urithi-tests.log"; exit 1; }
(cd web-app && npm run build >/dev/null)

echo "== 2. Envoi du code"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude /node_modules --exclude /data --exclude /storage --exclude /backups \
  --exclude /src/generated --exclude /.env --exclude /test \
  server-app/ "$HOST:/opt/urithi/app/server-app/"
rsync -az --delete -e "$RSYNC_SSH" web-app/dist/ "$HOST:/opt/urithi/app/web/"

echo "== 3. Dépendances, migrations, redémarrage"
"${SSH[@]}" 'set -euo pipefail
export PATH=/opt/urithi/runtime/node/bin:$PATH
cd /opt/urithi/app/server-app
set -a; . /opt/urithi/urithi.env; set +a
npm ci --include=dev --no-audit --no-fund >/dev/null
npm run db:mysql:deploy >/dev/null
chown -R urithi:urithi /opt/urithi/app
systemctl restart urithi
sleep 3
systemctl is-active urithi'

echo "== 4. Vérification"
for url in "$SITE/" "$SITE/api/health" "$SITE/api/public/games/missions"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  echo "$code $url"
  [ "$code" = 200 ] || { echo "Le site ne répond pas correctement : déploiement à vérifier."; exit 1; }
done

echo "== 5. GitHub"
git add -A
if git diff --cached --quiet; then
  echo "Aucun changement à enregistrer."
else
  git commit -q -m "$MESSAGE"
fi
git push -u origin main
echo "Déploiement terminé : $SITE"
