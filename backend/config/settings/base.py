"""
Paramètres communs à tous les environnements.

Toute valeur sensible ou propre à un environnement est lue depuis les variables
d'environnement (fichier .env en local, secrets du conteneur en production).
Aucun secret ne doit être écrit dans ce fichier.
"""
from __future__ import annotations

import logging
import os
from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

from config.envfile import is_placeholder, new_secret, write_env_value

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # .../backend
PROJECT_DIR = BASE_DIR.parent  # racine du dépôt
ENV_FILE = Path(os.environ.get("DJANGO_ENV_FILE", PROJECT_DIR / ".env"))

# django-environ : lecture typée des variables. Le fichier .env ne remplace jamais une
# variable déjà définie (secrets du conteneur, CI…), il ne fait que compléter.
env = environ.Env()
if ENV_FILE.is_file():
    environ.Env.read_env(ENV_FILE, overwrite=False)

IS_PRODUCTION = os.environ.get("DJANGO_SETTINGS_MODULE", "").endswith(".prod")


def secret(name: str) -> str:
    """
    Lit un secret obligatoire.

    - Production : absent ou valeur d'exemple (« change-me… ») → démarrage refusé.
    - Développement / tests : généré aléatoirement, puis enregistré dans le .env pour rester
      stable d'un redémarrage à l'autre (sinon les sessions et jetons seraient invalidés).
    """
    value = env.str(name, default="")
    if not is_placeholder(value):
        return value
    if IS_PRODUCTION:
        raise ImproperlyConfigured(
            f"{name} est absent ou vaut encore la valeur d'exemple. "
            "Générez-le avec : python manage.py generate_secret_key"
        )
    value = new_secret()
    os.environ[name] = value
    try:
        write_env_value(ENV_FILE, name, value)
        logging.getLogger("portfolio.security").warning("%s absent ou provisoire : valeur aléatoire générée dans %s.", name, ENV_FILE)
    except OSError:  # dossier en lecture seule : valeur valable pour ce processus uniquement
        logging.getLogger("portfolio.security").warning("%s généré pour ce processus uniquement (.env non modifiable).", name)
    return value


# ---------------------------------------------------------------------------
# Cœur Django
# ---------------------------------------------------------------------------
SECRET_KEY = secret("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    # Tiers
    "rest_framework",
    "axes",
    # Applications métier
    "apps.core",
    "apps.accounts",
    "apps.audit",
    "apps.projects",
    "apps.skills",
    "apps.career",
    "apps.contact",
]
# Django Admin n'est volontairement pas installé : l'administration passe
# exclusivement par la page d'administration React (frontend/admin.html) et l'API protégée.

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.security_headers.SecurityHeadersMiddleware",
    "apps.core.middleware.admin_guard.AdminAreaGuardMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.http.ConditionalGetMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.request_validation.RequestValidationMiddleware",
    "apps.core.middleware.request_logging.RequestLoggingMiddleware",
    # Axes doit rester en dernier (recommandation de la bibliothèque).
    "axes.middleware.AxesMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ],
        },
    }
]

# ---------------------------------------------------------------------------
# Base de données : PostgreSQL via psycopg 3
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env.str("POSTGRES_DB", default="portfolio"),
        "USER": env.str("POSTGRES_USER", default="portfolio"),
        "PASSWORD": env.str("POSTGRES_PASSWORD", default=""),
        "HOST": env.str("POSTGRES_HOST", default="localhost"),
        "PORT": env.str("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": env.int("POSTGRES_CONN_MAX_AGE", default=60),
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {"connect_timeout": 5},
    }
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Cache partagé entre workers (throttling, verrouillages) sans service supplémentaire.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "portfolio_cache",
        "TIMEOUT": 300,
        "OPTIONS": {"MAX_ENTRIES": 20000},
    }
}
REDIS_URL = env.str("REDIS_URL", default="")
if REDIS_URL:
    CACHES["default"] = {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }

# ---------------------------------------------------------------------------
# Authentification et mots de passe
# ---------------------------------------------------------------------------
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",  # protection anti-force brute
    "django.contrib.auth.backends.ModelBackend",
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",  # Argon2id
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",  # migration de hachages existants
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 14},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PORTFOLIO_ADMIN_GROUP = "portfolio_admins"
PASSWORD_RESET_ENABLED = env.bool("PASSWORD_RESET_ENABLED", default=True)
PASSWORD_RESET_TIMEOUT = 30 * 60  # secondes

# ---------------------------------------------------------------------------
# Sessions et CSRF
# ---------------------------------------------------------------------------
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "pf_sessionid"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = True  # expiration glissante

CSRF_COOKIE_NAME = "pf_csrftoken"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # lu par le JS pour l'en-tête X-CSRFToken (usage standard Django)
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
CSRF_FAILURE_VIEW = "apps.core.views.csrf_failure"

# ---------------------------------------------------------------------------
# En-têtes de sécurité (complétés par SecurityHeadersMiddleware et Nginx)
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "img-src 'self' data:; "
    "script-src 'self'; "
    "style-src 'self'; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "media-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none'"
)
PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"

# Proxy inverse : faire confiance à X-Real-IP uniquement si Nginx est devant.
TRUST_PROXY_HEADERS = env.bool("TRUST_PROXY_HEADERS", default=False)
if TRUST_PROXY_HEADERS:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Liste blanche d'IP pour l'espace d'administration (vide = désactivée).
ADMIN_ALLOWED_IPS = env.list("ADMIN_ALLOWED_IPS", default=[])
IP_HASH_SALT = secret("IP_HASH_SALT")

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],  # refus par défaut
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_THROTTLE_CLASSES": [
        "apps.core.throttling.AnonBurstThrottle",
        "apps.core.throttling.UserBurstThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env.str("THROTTLE_ANON", default="120/min"),
        "user": env.str("THROTTLE_USER", default="600/min"),
        "public": env.str("THROTTLE_PUBLIC", default="120/min"),
        "contact": env.str("THROTTLE_CONTACT", default="5/hour"),
        "contact_daily": env.str("THROTTLE_CONTACT_DAILY", default="20/day"),
        "login": env.str("THROTTLE_LOGIN", default="10/min"),
        "password_reset": env.str("THROTTLE_PASSWORD_RESET", default="3/hour"),
        "csrf": "60/min",
        "upload": env.str("THROTTLE_UPLOAD", default="60/hour"),
    },
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

# ---------------------------------------------------------------------------
# django-axes : verrouillage après échecs de connexion
# ---------------------------------------------------------------------------
AXES_FAILURE_LIMIT = env.int("AXES_FAILURE_LIMIT", default=5)
AXES_COOLOFF_TIME = timedelta(minutes=env.int("AXES_COOLOFF_MINUTES", default=15))
AXES_LOCKOUT_PARAMETERS = [["username", "ip_address"]]
AXES_RESET_ON_SUCCESS = True
AXES_CLIENT_IP_CALLABLE = "apps.core.net.get_client_ip"
AXES_LOCKOUT_CALLABLE = "apps.accounts.views.lockout_response"
AXES_VERBOSE = False

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "fr"
LANGUAGES = [("fr", "Français"), ("en", "English")]
PORTFOLIO_LANGUAGES = ("fr", "en")
TIME_ZONE = env.str("DJANGO_TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Fichiers statiques et médias
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = Path(env.str("DJANGO_STATIC_ROOT", default=str(BASE_DIR / "staticfiles")))

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env.str("DJANGO_MEDIA_ROOT", default=str(BASE_DIR / "media")))
FILE_UPLOAD_PERMISSIONS = 0o640
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o750
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200
DATA_UPLOAD_MAX_NUMBER_FILES = 10

UPLOAD_LIMITS = {
    "image_max_bytes": 5 * 1024 * 1024,
    "image_max_pixels": 6000 * 6000,
    "image_max_side": 6000,
    "pdf_max_bytes": 10 * 1024 * 1024,
    "images_per_project": 12,
}
IMAGE_WIDTHS = (480, 960, 1600)

# Frontend public React. FRONTEND_DIR : sortie de « npm run build » (Vite) ; FRONTEND_BUILD_DIR : dossier
# publié, complété par les pages SEO générées (servi par Nginx en production, par Django en développement).
FRONTEND_DIR = Path(env.str("FRONTEND_DIR", default=str(PROJECT_DIR / "frontend" / "dist")))
FRONTEND_BUILD_DIR = Path(env.str("FRONTEND_BUILD_DIR", default=str(PROJECT_DIR / "frontend" / "dist")))
SITE_URL = env.str("SITE_URL", default="http://localhost:8000").rstrip("/")
DASHBOARD_PREFIX = env.str("DASHBOARD_PREFIX", default="gestion").strip("/")

# ---------------------------------------------------------------------------
# E-mails
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env.str("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env.str("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env.str("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env.str("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = env.str("DEFAULT_FROM_EMAIL", default="portfolio@localhost")
SERVER_EMAIL = DEFAULT_FROM_EMAIL
CONTACT_NOTIFY_EMAIL = env.str("CONTACT_NOTIFY_EMAIL", default="")

# Anti-spam du formulaire de contact
CONTACT_MIN_FILL_SECONDS = env.int("CONTACT_MIN_FILL_SECONDS", default=3)
CONTACT_TOKEN_MAX_AGE = 2 * 60 * 60

# ---------------------------------------------------------------------------
# Journalisation (jamais de mot de passe, de jeton ni de cookie)
# ---------------------------------------------------------------------------
LOG_DIR = Path(env.str("DJANGO_LOG_DIR", default=str(BASE_DIR / "logs")))
LOG_LEVEL = env.str("DJANGO_LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"redact": {"()": "apps.core.logging.RedactSecretsFilter"}},
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "filters": ["redact"],
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "portfolio.security": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "portfolio.requests": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "axes": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
