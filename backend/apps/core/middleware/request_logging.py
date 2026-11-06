"""
Journalisation des requêtes sensibles (authentification, administration, contact) et des
erreurs serveur. Seules des métadonnées sont enregistrées : ni corps de requête, ni
en-têtes d'authentification, ni cookies.
"""
import logging
import time

from django.conf import settings

from ..net import request_ip_hash

logger = logging.getLogger("portfolio.requests")


class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.sensitive_prefixes = (
            "/api/v1/auth/",
            "/api/v1/admin/",
            "/api/v1/contact/",
            f"/{settings.DASHBOARD_PREFIX}/",
        )

    def __call__(self, request):
        started = time.monotonic()
        response = self.get_response(request)
        sensitive = request.path.startswith(self.sensitive_prefixes)
        if sensitive and request.method != "GET" or response.status_code >= 500 or response.status_code in (401, 403, 429):
            user = getattr(request, "user", None)
            logger.info(
                "request method=%s path=%s status=%s user_id=%s ip_hash=%s duration_ms=%d",
                request.method,
                request.path,
                response.status_code,
                getattr(user, "pk", None) if user is not None and user.is_authenticated else None,
                request_ip_hash(request),
                (time.monotonic() - started) * 1000,
            )
        return response
