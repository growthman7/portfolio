# Image de production du backend Django (et du frontend construit, partagé avec Nginx).

# --- Étape 1 : construction du frontend React (Vite) ---
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Étape 2 : backend Django ---
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8000 \
    WEB_CONCURRENCY=3

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 postgresql-client fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system app && useradd --system --gid app --home /srv/app --shell /usr/sbin/nologin app

WORKDIR /srv/app
COPY backend/requirements /srv/app/requirements
RUN pip install -r requirements/prod.txt

COPY backend /srv/app
COPY --from=frontend /app/dist /srv/frontend-src

# Fichiers statiques du dashboard et frontend de production construits dans l'image.
# Valeurs factices uniquement pour la construction (aucun secret dans l'image).
RUN DJANGO_SECRET_KEY=build-only-$(date +%s)-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    IP_HASH_SALT=build-only-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    DJANGO_ALLOWED_HOSTS=localhost DJANGO_STATIC_ROOT=/srv/static \
    python manage.py collectstatic --noinput \
 && DJANGO_SECRET_KEY=build-only-$(date +%s)-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    IP_HASH_SALT=build-only-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    DJANGO_ALLOWED_HOSTS=localhost \
    python manage.py build_frontend --source /srv/frontend-src --target /srv/frontend-build --skip-seo \
 && mkdir -p /srv/media /srv/frontend /srv/static-public /srv/app/logs \
 && chown -R app:app /srv/media /srv/frontend /srv/static-public /srv/app/logs \
 && chmod -R a-w /srv/app /srv/static /srv/frontend-build \
 && chmod u+w /srv/app/logs

COPY --chmod=0555 deploy/docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Pas de « USER app » ici : l'entrypoint abandonne lui-même les privilèges root après avoir attribué le
# disque des médias (hébergeurs comme Render). Docker Compose impose « user: app » dès le démarrage.
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/healthz/' % __import__('os').environ.get('PORT', '8000'), timeout=4).status == 200 else 1)"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Gunicorn lit PORT (adresse d'écoute 0.0.0.0:$PORT) et WEB_CONCURRENCY (nombre de workers) : réglables par l'hébergeur.
CMD ["gunicorn", "config.wsgi:application", "--threads", "2", "--timeout", "30", "--max-requests", "1000", "--max-requests-jitter", "100", "--access-logfile", "-", "--forwarded-allow-ips", "*"]
