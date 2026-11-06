#!/bin/sh
# Restauration d'une sauvegarde : ./deploy/scripts/restore_db.sh backups/db-AAAAMMJJTHHMMSSZ.dump.gpg [backups/media-….tar.gz.gpg]
# ATTENTION : remplace les données actuelles. Testez régulièrement la restauration sur un environnement séparé.
set -eu
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
DB_FILE="${1:?Fichier de sauvegarde de la base requis}"
MEDIA_FILE="${2:-}"

printf "Restaurer %s ? Les données actuelles seront remplacées. Tapez OUI : " "$DB_FILE"
read -r answer
[ "$answer" = "OUI" ] || { echo "Annulé."; exit 1; }

gpg --batch --quiet --passphrase "$BACKUP_PASSPHRASE" -d "$DB_FILE" \
  | docker compose -f docker-compose.prod.yml exec -T db \
    pg_restore -U "$POSTGRES_OWNER_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --role="$POSTGRES_OWNER_USER"

if [ -n "$MEDIA_FILE" ]; then
  gpg --batch --quiet --passphrase "$BACKUP_PASSPHRASE" -d "$MEDIA_FILE" \
    | docker compose -f docker-compose.prod.yml exec -T web tar -C /srv/media -xzf -
fi
docker compose -f docker-compose.prod.yml restart web
echo "Restauration terminée."
