"""
Validation des URL saisies (dépôts, démonstrations, réseaux).

Le serveur ne télécharge jamais ces URL (aucun risque SSRF côté backend) ; elles sont
uniquement affichées. On impose malgré tout HTTPS, l'absence d'identifiants intégrés
et un hôte public, pour ne pas exposer des liens dangereux aux visiteurs.
"""
import ipaddress
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

_url_validator = URLValidator(schemes=["https"])


def validate_public_https_url(value: str) -> None:
    if not value:
        return
    _url_validator(value)
    parts = urlsplit(value)
    if parts.username or parts.password:
        raise ValidationError("Les identifiants dans l'URL sont interdits.", code="credentials")
    host = (parts.hostname or "").lower()
    if host in {"localhost"} or host.endswith((".local", ".internal", ".localhost")):
        raise ValidationError("L'URL doit pointer vers un hôte public.", code="private_host")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return
    if not ip.is_global:
        raise ValidationError("L'URL doit pointer vers une adresse publique.", code="private_ip")
