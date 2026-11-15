"""Tests de bout en bout (Playwright) : réglages de test, avec le frontend construit servi par Django."""
from .test import *
from .test import BASE_DIR

E2E = True
SERVE_FRONTEND = True
# Copie de frontend/dist faite par les tests : les pages SEO générées n'écrivent jamais dans dist.
FRONTEND_BUILD_DIR = BASE_DIR / ".test-frontend-e2e"
