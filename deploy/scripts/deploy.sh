#!/bin/sh
# Mise à jour de la production, exécutée SUR LE SERVEUR (par la CD GitHub Actions ou à la main).
#  1. récupère la révision demandée (par défaut origin/main) ;
#  2. reconstruit l'image et redémarre les conteneurs (migrations appliquées au démarrage) ;
#  3. attend que le conteneur web soit « healthy », sinon échoue ;
#  4. nettoie les anciennes images.
set -eu

APP_DIR="${APP_DIR:-/opt/portfolio}"
REF="${1:-origin/main}"
COMPOSE="docker compose -f docker-compose.prod.yml"

cd "$APP_DIR"

echo "==> Récupération de $REF"
git fetch --prune origin
git reset --hard "$REF"
echo "Révision déployée : $(git rev-parse --short HEAD)"

echo "==> Construction de l'image"
$COMPOSE build --pull web

echo "==> Redémarrage des services"
$COMPOSE up -d --remove-orphans

echo "==> Attente de l'état healthy du conteneur web"
cid="$($COMPOSE ps -q web)"
i=0
while :; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo unknown)"
  [ "$status" = "healthy" ] && break
  i=$((i + 1))
  if [ "$i" -gt 36 ]; then
    echo "Le conteneur web n'est pas healthy (état : $status). Derniers journaux :"
    $COMPOSE logs --tail 80 web
    exit 1
  fi
  sleep 5
done
echo "web : healthy"

docker image prune -f >/dev/null
echo "==> Déploiement terminé"
