#!/bin/sh
# Démarrage du conteneur web :
#  1. attend PostgreSQL ;
#  2. applique les migrations avec le rôle PROPRIÉTAIRE (seul autorisé à modifier le schéma) ;
#  3. publie le frontend construit et les fichiers statiques dans les volumes lus par Nginx, puis régénère le SEO ;
#  4. lance Gunicorn avec le rôle APPLICATIF (droits limités aux données).
set -eu

# Hébergeur montant un disque appartenant à root (ex. disque persistant Render) : le conteneur démarre
# en root UNIQUEMENT pour attribuer /srv/media à l'utilisateur app, puis abandonne définitivement ses
# privilèges (aucune capacité, no_new_privs) avant toute autre action. Avec Docker Compose, le conteneur
# démarre directement en utilisateur app (« user: app ») et ce bloc est ignoré.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /srv/media
  find /srv/media ! -user app -exec chown app:app {} +
  chmod 750 /srv/media
  # Vider le « bounding set » exige CAP_SETPCAP, que certains hébergeurs (Render) retirent au conteneur :
  # on ne le demande que s'il est permis. Le passage à l'utilisateur app retire de toute façon les
  # capacités effectives et permises, et no_new_privs interdit d'en regagner.
  drop="--reuid=app --regid=app --init-groups --inh-caps=-all --no-new-privs"
  if setpriv $drop --bounding-set=-all true 2>/dev/null; then
    drop="$drop --bounding-set=-all"
  fi
  # shellcheck disable=SC2086
  exec setpriv $drop -- "$0" "$@"
fi

export DJANGO_MEDIA_ROOT=/srv/media DJANGO_STATIC_ROOT=/srv/static FRONTEND_BUILD_DIR=/srv/frontend DJANGO_LOG_DIR=/srv/app/logs

echo "Attente de PostgreSQL…"
i=0
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -q; do
  i=$((i + 1)); [ "$i" -gt 60 ] && echo "PostgreSQL indisponible." && exit 1
  sleep 1
done

# Les médias doivent être persistants (volume Docker, disque Render) et inscriptibles par l'utilisateur app.
if ! touch /srv/media/.write-test 2>/dev/null; then
  echo "ERREUR : /srv/media n'est pas inscriptible par l'utilisateur $(id -un). Vérifiez le volume ou le disque monté." >&2
  exit 1
fi
rm -f /srv/media/.write-test

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
