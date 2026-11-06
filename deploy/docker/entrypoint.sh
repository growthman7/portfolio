#!/bin/sh
# Démarrage du conteneur web :
#  1. attend PostgreSQL ;
#  2. applique les migrations avec le rôle PROPRIÉTAIRE (seul autorisé à modifier le schéma) ;
#  3. publie le frontend construit et les fichiers statiques dans les volumes lus par Nginx, puis régénère le SEO ;
#  4. lance Gunicorn avec le rôle APPLICATIF (droits limités aux données).
set -eu

export DJANGO_MEDIA_ROOT=/srv/media DJANGO_STATIC_ROOT=/srv/static FRONTEND_BUILD_DIR=/srv/frontend DJANGO_LOG_DIR=/srv/app/logs

echo "Attente de PostgreSQL…"
i=0
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -q; do
  i=$((i + 1)); [ "$i" -gt 60 ] && echo "PostgreSQL indisponible." && exit 1
  sleep 1
done

as_owner() {
  POSTGRES_USER="$POSTGRES_OWNER_USER" POSTGRES_PASSWORD="$POSTGRES_OWNER_PASSWORD" "$@"
}

as_owner python manage.py migrate --noinput
as_owner python manage.py createcachetable
python manage.py seed_placeholders

# Publication du frontend construit dans le volume partagé (lu par Nginx en lecture seule).
find /srv/frontend -mindepth 1 -delete
cp -R /srv/frontend-build/. /srv/frontend/
chmod -R u+w /srv/frontend
find /srv/static-public -mindepth 1 -delete
cp -R /srv/static/. /srv/static-public/
python manage.py build_seo

exec "$@"
