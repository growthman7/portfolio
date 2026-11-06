"""Paramètres de développement local (jamais en production)."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# En local, HTTP simple : les cookies ne peuvent pas être « Secure ».
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

EMAIL_BACKEND = env.str("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")

# Django sert lui-même le frontend et les médias en développement (voir config/urls.py).
SERVE_FRONTEND = True
