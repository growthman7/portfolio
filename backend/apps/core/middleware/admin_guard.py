"""
Garde de l'espace d'administration.

- Liste blanche d'adresses IP optionnelle (ADMIN_ALLOWED_IPS) pour le dashboard et l'API admin.
- Aucune mise en cache des réponses d'administration (navigateur ou proxy).
L'authentification et l'autorisation elles-mêmes sont vérifiées par les vues (permissions DRF).
"""
import ipaddress
import logging

from django.conf import settings
from django.http import JsonResponse

from ..net import get_client_ip, hash_ip

logger = logging.getLogger("portfolio.security")


class AdminAreaGuardMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.prefixes = ("/api/v1/admin/", "/api/v1/auth/", f"/{settings.DASHBOARD_PREFIX}/")
        self.networks = [ipaddress.ip_network(item, strict=False) for item in settings.ADMIN_ALLOWED_IPS]

    def _ip_allowed(self, ip: str) -> bool:
        if not self.networks:
            return True
        try:
            address = ipaddress.ip_address(ip)
        except ValueError:
            return False
        return any(address in network for network in self.networks)

    def __call__(self, request):
        is_admin_area = request.path.startswith(self.prefixes)
        if is_admin_area:
            ip = get_client_ip(request)
            if not self._ip_allowed(ip):
                logger.warning("admin_ip_denied ip_hash=%s path=%s", hash_ip(ip), request.path)
                return JsonResponse({"detail": "Ressource introuvable."}, status=404)
        response = self.get_response(request)
        if is_admin_area:
            response.headers["Cache-Control"] = "no-store, private"
            response.headers["Pragma"] = "no-cache"
        return response
