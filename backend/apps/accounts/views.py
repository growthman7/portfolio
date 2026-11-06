"""
Contrôleurs d'authentification de l'administrateur.

Aucune route ne permet de créer un compte : le premier administrateur est créé en ligne
de commande (`manage.py create_portfolio_admin`).
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import (
    authenticate,
    get_user_model,
    login,
    logout,
    password_validation,
    update_session_auth_hash,
)
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.permissions import IsPortfolioAdmin, is_portfolio_admin
from apps.core.throttling import LoginThrottle, PasswordResetThrottle, ScopedIpThrottle
from apps.core.viewsets import EnforceCSRFMixin

from .serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)

logger = logging.getLogger("portfolio.security")
User = get_user_model()

INVALID_CREDENTIALS = "Identifiant ou mot de passe incorrect."
LOCKED_OUT = "Trop de tentatives de connexion. Réessayez dans quelques minutes."
RESET_ACCEPTED = "Si un compte administrateur correspond à cette adresse, un e-mail vient d'être envoyé."


def lockout_response(request, *args, **kwargs):
    """Réponse renvoyée par django-axes quand le couple identifiant + IP est verrouillé."""
    return JsonResponse({"detail": LOCKED_OUT}, status=429)


def _user_payload(user) -> dict:
    return {
        "username": user.get_username(),
        "email": user.email,
        "first_name": user.first_name,
        "is_superuser": user.is_superuser,
        "last_login": user.last_login,
        "permissions": sorted(user.get_all_permissions()),
    }


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Pose le cookie CSRF et renvoie le jeton (utile avant le premier POST)."""

    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ScopedIpThrottle,)
    throttle_scope = "csrf"

    def get(self, request):
        return Response({"csrf_token": get_token(request)}, headers={"Cache-Control": "no-store"})


class LoginView(EnforceCSRFMixin, APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (LoginThrottle,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        django_request = request._request
        user = authenticate(
            django_request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if getattr(django_request, "axes_locked_out", False):
            return Response({"detail": LOCKED_OUT}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if user is not None and not is_portfolio_admin(user):
            record(request, AuditLog.Action.LOGIN_FAILED, username=user.get_username()[:150], reason="not_admin")
            user = None
        if user is None:
            # Message identique que l'identifiant existe ou non (pas d'énumération de comptes).
            return Response({"detail": INVALID_CREDENTIALS}, status=status.HTTP_400_BAD_REQUEST)
        login(django_request, user)  # rotation de l'identifiant de session (anti-fixation)
        return Response({"user": _user_payload(user)})


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user = request.user
        record(request, AuditLog.Action.LOGOUT, actor=user)
        logout(request._request)  # détruit la session côté serveur
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = (IsAuthenticated, IsPortfolioAdmin)

    def get(self, request):
        return Response({"user": _user_payload(request.user)})


class PasswordChangeView(APIView):
    permission_classes = (IsAuthenticated, IsPortfolioAdmin)
    throttle_classes = (PasswordResetThrottle,)

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        update_session_auth_hash(request._request, user)  # les autres sessions sont invalidées
        record(request, AuditLog.Action.PASSWORD_CHANGED, actor=user)
        return Response({"detail": "Mot de passe modifié."})


class PasswordResetRequestView(EnforceCSRFMixin, APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (PasswordResetThrottle,)

    def post(self, request):
        if not settings.PASSWORD_RESET_ENABLED:
            return Response({"detail": "Ressource introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        for user in User.objects.filter(email__iexact=email, is_active=True, is_staff=True):
            if not is_portfolio_admin(user) or not user.has_usable_password():
                continue
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.SITE_URL}/{settings.DASHBOARD_PREFIX}/reinitialisation/{uid}/{token}/"
            minutes = settings.PASSWORD_RESET_TIMEOUT // 60
            try:
                send_mail(
                    "[Portfolio] Réinitialisation du mot de passe",
                    (
                        "Une réinitialisation du mot de passe administrateur a été demandée.\n\n"
                        f"Lien valable {minutes} minutes et utilisable une seule fois :\n{link}\n\n"
                        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
                    ),
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                )
            except Exception:
                logger.exception("password_reset_mail_failed user_id=%s", user.pk)
            record(request, AuditLog.Action.PASSWORD_RESET_REQUESTED, actor=user)
        # Réponse identique que l'adresse existe ou non.
        return Response({"detail": RESET_ACCEPTED}, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(EnforceCSRFMixin, APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (PasswordResetThrottle,)

    def post(self, request):
        if not settings.PASSWORD_RESET_ENABLED:
            return Response({"detail": "Ressource introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invalid = Response({"detail": "Lien invalide ou expiré."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(data["uid"])), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError, DjangoValidationError):
            return invalid
        if not is_portfolio_admin(user) or not default_token_generator.check_token(user, data["token"]):
            return invalid
        try:
            password_validation.validate_password(data["new_password"], user)
        except DjangoValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        # Changer le mot de passe invalide le jeton (usage unique) et toutes les sessions existantes.
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        try:
            from axes.utils import reset

            reset(username=user.get_username())
        except Exception:  # noqa: BLE001 — best effort, ne doit pas bloquer la réinitialisation  # pragma: no cover
            logger.warning("axes_reset_failed user_id=%s", user.pk)
        record(request, AuditLog.Action.PASSWORD_RESET_DONE, actor=user)
        return Response({"detail": "Mot de passe réinitialisé. Vous pouvez vous connecter."})
