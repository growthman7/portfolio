"""Classes de base partagées par les vues d'API publiques et d'administration."""
from __future__ import annotations

from django.db import transaction
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny

from apps.audit.models import AuditLog
from apps.audit.services import record

from .i18n import get_request_language
from .permissions import ADMIN_PERMISSION_CLASSES
from .throttling import ScopedIpThrottle


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


class EnforceCSRFMixin:
    """
    DRF désactive la vérification CSRF pour les requêtes anonymes. Les points d'entrée
    publics qui modifient l'état (contact, connexion, réinitialisation) la réactivent ici.
    """

    def initial(self, request, *args, **kwargs):
        check = _CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied(f"CSRF : {reason}")
        super().initial(request, *args, **kwargs)


class PublicReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Lecture publique : uniquement GET, uniquement le contenu publié, langue via ?lang=."""

    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ScopedIpThrottle,)
    throttle_scope = "public"
    pagination_class = None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["lang"] = get_request_language(self.request)
        return context

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=60"
            response.headers["Vary"] = "Accept-Encoding"
        return response


class AdminModelViewSet(viewsets.ModelViewSet):
    """CRUD d'administration : authentification + rôle + permission par modèle, actions journalisées."""

    permission_classes = ADMIN_PERMISSION_CLASSES

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        record(self.request, AuditLog.Action.CREATE, instance)

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save()
        record(self.request, AuditLog.Action.UPDATE, instance, fields=",".join(sorted(serializer.validated_data)))

    @transaction.atomic
    def perform_destroy(self, instance):
        record(self.request, AuditLog.Action.DELETE, instance)
        instance.delete()
