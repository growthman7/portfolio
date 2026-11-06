"""
Gestion centralisée des erreurs de l'API.

En production, aucune trace, requête SQL ou détail interne n'est renvoyé au client :
on renvoie un message générique et un identifiant d'erreur corrélé aux journaux.
"""
from __future__ import annotations

import logging
import uuid

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DatabaseError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("portfolio.requests")

GENERIC_MESSAGES = {
    400: "Requête invalide.",
    401: "Authentification requise.",
    403: "Accès refusé.",
    404: "Ressource introuvable.",
    405: "Méthode non autorisée.",
    413: "Contenu trop volumineux.",
    415: "Type de contenu non pris en charge.",
    429: "Trop de requêtes. Merci de patienter avant de réessayer.",
}


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages})
    response = exception_handler(exc, context)

    if response is None:
        # Erreur inattendue : journalisée côté serveur, message neutre côté client.
        error_id = uuid.uuid4().hex[:12]
        request = context.get("request")
        logger.exception(
            "api_unhandled_error id=%s path=%s",
            error_id,
            getattr(request, "path", "?"),
            exc_info=exc,
        )
        payload = {"detail": "Une erreur interne est survenue.", "error_id": error_id}
        if settings.DEBUG and not isinstance(exc, DatabaseError):
            payload["debug"] = repr(exc)
        return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if isinstance(exc, (Http404, PermissionDenied)) or response.status_code in (401, 403, 404, 405, 415):
        response.data = {"detail": GENERIC_MESSAGES.get(response.status_code, "Erreur.")}
    elif response.status_code == 429:
        wait = getattr(exc, "wait", None)
        response.data = {"detail": GENERIC_MESSAGES[429]}
        if wait:
            response.data["retry_after"] = int(wait)
    return response
