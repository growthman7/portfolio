import logging

from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.db.models.signals import post_migrate
from django.dispatch import receiver

logger = logging.getLogger("portfolio.security")


@receiver(post_migrate)
def ensure_admin_group(sender, app_config=None, **kwargs):
    # Exécuté après la dernière application installée (dashboard), quand toutes les permissions existent.
    if app_config is not None and app_config.label == "dashboard":
        from .services import sync_admin_group

        sync_admin_group()


@receiver(user_login_failed)
def log_login_failed(sender, credentials, request=None, **kwargs):
    # `credentials` est déjà nettoyé par Django (le mot de passe y est masqué) ; on ne journalise que l'identifiant.
    from apps.audit.models import AuditLog
    from apps.audit.services import record

    username = str(credentials.get("username", ""))[:150]
    locked = bool(getattr(request, "axes_locked_out", False))
    record(request, AuditLog.Action.LOGIN_LOCKED if locked else AuditLog.Action.LOGIN_FAILED, username=username)


@receiver(user_logged_in)
def log_login_success(sender, request, user, **kwargs):
    from apps.audit.models import AuditLog
    from apps.audit.services import record

    record(request, AuditLog.Action.LOGIN_SUCCESS, actor=user)
