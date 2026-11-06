"""Limitation du nombre de requêtes (rate limiting) basée sur l'IP fiable."""
from rest_framework.throttling import (
    AnonRateThrottle,
    ScopedRateThrottle,
    SimpleRateThrottle,
    UserRateThrottle,
)

from .net import get_client_ip


class _ClientIpMixin:
    def get_ident(self, request):  # remplace la lecture de X-Forwarded-For par DRF
        return get_client_ip(request)


class AnonBurstThrottle(_ClientIpMixin, AnonRateThrottle):
    pass


class UserBurstThrottle(_ClientIpMixin, UserRateThrottle):
    pass


class ScopedIpThrottle(_ClientIpMixin, ScopedRateThrottle):
    """Limite par portée (`throttle_scope` de la vue) et par IP, même pour un utilisateur connecté."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class _FixedScopeIpThrottle(_ClientIpMixin, SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ContactHourlyThrottle(_FixedScopeIpThrottle):
    scope = "contact"


class ContactDailyThrottle(_FixedScopeIpThrottle):
    scope = "contact_daily"


class LoginThrottle(_FixedScopeIpThrottle):
    scope = "login"


class PasswordResetThrottle(_FixedScopeIpThrottle):
    scope = "password_reset"


class UploadThrottle(_FixedScopeIpThrottle):
    scope = "upload"
