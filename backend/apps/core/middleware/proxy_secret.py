"""
Restreint l'accès au backend aux requêtes relayées par le proxy de confiance (frontend Vercel).

Quand PROXY_SHARED_SECRET est défini, toute requête doit présenter l'en-tête X-Portfolio-Proxy-Secret
avec cette valeur (comparaison en temps constant). Vercel l'ajoute à chaque requête relayée
(transform « request.headers » dans frontend/vercel.json, valeur lue dans ses variables d'environnement). Un appel direct à l'adresse du backend reçoit 404 :
il ne peut ni contourner les en-têtes de sécurité du frontend, ni forger l'adresse IP cliente utilisée
par la limitation de débit, le verrouillage des connexions et la liste blanche d'administration.

Seule exception : la sonde de disponibilité (/healthz/), appelée directement par l'hébergeur.
"""
import hmac
import logging

from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger("portfolio.security")

HEADER = "HTTP_X_PORTFOLIO_PROXY_SECRET"
EXEMPT_PATHS = frozenset({"/healthz/"})


class ProxySecretMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        secret = (getattr(settings, "PROXY_SHARED_SECRET", "") or "").encode()
        if secret and request.path not in EXEMPT_PATHS:
            provided = request.META.get(HEADER, "").encode()
            if not hmac.compare_digest(provided, secret):
                logger.warning("proxy_secret_rejected path=%s", request.path[:200])
                return JsonResponse({"detail": "Ressource introuvable."}, status=404)
            # Le secret ne doit jamais atteindre la suite du traitement (journaux, vues).
            del request.META[HEADER]
        return self.get_response(request)
