#!/bin/sh
# Sauvegarde chiffrée de la base PostgreSQL et des médias.
# À planifier quotidiennement (cron), par exemple :
#   15 3 * * * cd /opt/portfolio && ./deploy/scripts/backup_db.sh >> /var/log/portfolio-backup.log 2>&1
set -eu
cd "$(dirname "$0")/../.."
[ -f .env ] || { echo ".env introuvable"; exit 1; }
set -a; . ./.env; set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
umask 077
mkdir -p "$BACKUP_DIR"

# Base de données (format custom, restaurable avec pg_restore), chiffrée en AES-256.
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_OWNER_USER" -d "$POSTGRES_DB" --format=custom --no-owner \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" \
  -o "$BACKUP_DIR/db-$STAMP.dump.gpg"

# Médias (images, CV).
docker compose -f docker-compose.prod.yml exec -T web tar -C /srv/media -czf - . \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" \
  -o "$BACKUP_DIR/media-$STAMP.tar.gz.gpg"

# Vérification minimale : l'archive se déchiffre et liste son contenu.
gpg --batch --quiet --passphrase "$BACKUP_PASSPHRASE" -d "$BACKUP_DIR/db-$STAMP.dump.gpg" | head -c 5 | grep -q PGDMP

find "$BACKUP_DIR" -type f -name '*.gpg' -mtime "+$RETENTION" -delete
echo "Sauvegarde $STAMP terminée. Copiez $BACKUP_DIR hors du serveur (stockage distant)."
