"""Paramètres des tests automatisés (PostgreSQL réel, comme en production)."""
from .base import *  # noqa: F401,F403
from .base import BASE_DIR

DEBUG = False
SERVE_FRONTEND = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
ALLOWED_HOSTS = ["testserver", "localhost"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CONTACT_NOTIFY_EMAIL = "owner@example.test"
CONTACT_MIN_FILL_SECONDS = 0
MEDIA_ROOT = BASE_DIR / ".test-media"
FRONTEND_BUILD_DIR = BASE_DIR / ".test-frontend"
# Hachage rapide pour accélérer les tests ; Argon2 est vérifié par un test dédié.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
]
LOGGING = {"version": 1, "disable_existing_loggers": True, "root": {"level": "CRITICAL", "handlers": []}}
