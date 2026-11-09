"""Paramètres de production. Toute erreur de configuration doit empêcher le démarrage."""
from django.core.exceptions import ImproperlyConfigured

from .base import *
from .base import (
    CLIENT_IP_HEADER,
    LOG_DIR,
    LOGGING,
    PROXY_SHARED_SECRET,
    SECRET_KEY,
    env,
)

DEBUG = False

if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("change-me"):
    raise ImproperlyConfigured("DJANGO_SECRET_KEY doit être une valeur aléatoire d'au moins 50 caractères.")

if PROXY_SHARED_SECRET and (len(PROXY_SHARED_SECRET) < 32 or PROXY_SHARED_SECRET.startswith("change-me")):
    raise ImproperlyConfigured("PROXY_SHARED_SECRET doit être une valeur aléatoire d'au moins 32 caractères.")

# Un en-tête d'IP autre que X-Real-IP (écrasé par Nginx) n'est fiable que si l'accès direct est bloqué.
if CLIENT_IP_HEADER.lower() != "x-real-ip" and not PROXY_SHARED_SECRET:
    raise ImproperlyConfigured("CLIENT_IP_HEADER personnalisé : PROXY_SHARED_SECRET est obligatoire.")

# HTTPS obligatoire
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("DJANGO_HSTS_INCLUDE_SUBDOMAINS", default=True)
SECURE_HSTS_PRELOAD = env.bool("DJANGO_HSTS_PRELOAD", default=False)
SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SERVE_FRONTEND = False

# Le préchargement HSTS est un engagement long à retirer : il est volontairement optionnel
# (DJANGO_HSTS_PRELOAD=true après validation du domaine et de ses sous-domaines).
if not SECURE_HSTS_PRELOAD:
    SILENCED_SYSTEM_CHECKS = ["security.W021"]

# Journal fichier en rotation, en plus de la sortie standard du conteneur.
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOGGING["handlers"]["file"] = {
    "class": "logging.handlers.RotatingFileHandler",
    "filename": str(LOG_DIR / "portfolio.log"),
    "maxBytes": 5 * 1024 * 1024,
    "backupCount": 10,
    "formatter": "standard",
    "filters": ["redact"],
}
for _name in ("portfolio.security", "portfolio.requests", "django.security", "axes"):
    LOGGING["loggers"][_name]["handlers"].append("file")
LOGGING["root"]["handlers"].append("file")
