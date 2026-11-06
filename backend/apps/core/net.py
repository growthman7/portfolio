"""Identification fiable de l'adresse IP cliente et pseudonymisation."""
from __future__ import annotations

import hashlib
import hmac
import ipaddress

from django.conf import settings


def get_client_ip(request) -> str:
    """
    Derrière Nginx, l'en-tête X-Real-IP est écrasé par le proxy avec l'adresse réelle
    ($remote_addr) : il ne peut pas être forgé par le client. Sans proxy de confiance,
    on utilise REMOTE_ADDR. X-Forwarded-For (falsifiable) n'est jamais lu.
    """
    candidate = None
    if getattr(settings, "TRUST_PROXY_HEADERS", False):
        candidate = request.META.get("HTTP_X_REAL_IP")
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
