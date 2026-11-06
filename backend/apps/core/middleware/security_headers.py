"""Ajoute la Content Security Policy et la Permissions-Policy à toutes les réponses Django."""
from django.conf import settings


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.csp = settings.CONTENT_SECURITY_POLICY
        self.permissions_policy = settings.PERMISSIONS_POLICY

    def __call__(self, request):
        response = self.get_response(request)
        response.headers.setdefault("Content-Security-Policy", self.csp)
        response.headers.setdefault("Permissions-Policy", self.permissions_policy)
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        if request.path.startswith("/api/"):
            # Les réponses d'API ne doivent jamais être interprétées comme du HTML.
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
        return response
