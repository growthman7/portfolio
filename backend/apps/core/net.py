"""Identification fiable de l'adresse IP cliente et pseudonymisation."""
from __future__ import annotations

import hashlib
import hmac
import ipaddress

from django.conf import settings


def get_client_ip(request) -> str:
    """
    Adresse IP cliente, lue dans l'en-tête posé par le proxy de confiance (CLIENT_IP_HEADER) :
    - derrière Nginx : X-Real-IP, écrasé par le proxy avec $remote_addr ;
    - derrière Vercel (frontend) → Render (backend) : premier élément de X-Forwarded-For, que Vercel
      remplace par l'adresse du visiteur (les hôpitaux suivants, comme Render, ajoutent à la fin).
      Accepté uniquement parce que ProxySecretMiddleware refuse toute requête sans le secret partagé :
      un appel direct au backend ne peut donc pas falsifier cet en-tête (vérifié au démarrage, prod.py).
    Sans proxy de confiance, on utilise REMOTE_ADDR et aucun en-tête n'est lu.
    """
    candidate = None
    if getattr(settings, "TRUST_PROXY_HEADERS", False):
        header = getattr(settings, "CLIENT_IP_HEADER", "X-Real-IP")
        candidate = (request.META.get("HTTP_" + header.upper().replace("-", "_")) or "").split(",")[0]
    candidate = (candidate or request.META.get("REMOTE_ADDR") or "").strip()
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return "0.0.0.0"


def hash_ip(ip: str) -> str:
    """Hachage HMAC salé : permet de corréler des événements sans stocker l'IP en clair (RGPD)."""
    return hmac.new(settings.IP_HASH_SALT.encode(), ip.encode(), hashlib.sha256).hexdigest()[:32]


def request_ip_hash(request) -> str:
    return hash_ip(get_client_ip(request))
