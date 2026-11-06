"""
Permissions de l'API. Toute décision d'accès est prise ici, côté serveur.
Le dashboard (frontend) ne fait que refléter ces décisions.
"""
from django.conf import settings
from rest_framework.permissions import BasePermission, DjangoModelPermissions


def is_portfolio_admin(user) -> bool:
    if not (user and user.is_authenticated and user.is_active and user.is_staff):
        return False
    if user.is_superuser:
        return True
    return user.groups.filter(name=settings.PORTFOLIO_ADMIN_GROUP).exists()


class IsPortfolioAdmin(BasePermission):
    message = "Accès réservé à l'administrateur du portfolio."

    def has_permission(self, request, view) -> bool:
        return is_portfolio_admin(request.user)


class PortfolioModelPermissions(DjangoModelPermissions):
    """Exige aussi la permission « view » pour la lecture (non vérifiée par défaut par DRF)."""

    perms_map = {
        **DjangoModelPermissions.perms_map,
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": ["%(app_label)s.view_%(model_name)s"],
    }


ADMIN_PERMISSION_CLASSES = (IsPortfolioAdmin, PortfolioModelPermissions)
