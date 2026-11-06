"""Rôle administrateur : groupe dédié portant uniquement les permissions des applications du portfolio."""
from django.conf import settings
from django.contrib.auth.models import Group, Permission

MANAGED_APPS = ("core", "projects", "skills", "career", "contact", "audit")
READ_ONLY_MODELS = {("audit", "auditlog")}


def sync_admin_group() -> Group:
    group, _ = Group.objects.get_or_create(name=settings.PORTFOLIO_ADMIN_GROUP)
    permissions = []
    for perm in Permission.objects.filter(content_type__app_label__in=MANAGED_APPS).select_related("content_type"):
        key = (perm.content_type.app_label, perm.content_type.model)
        if key in READ_ONLY_MODELS and not perm.codename.startswith("view_"):
            continue  # le journal d'audit n'est jamais modifiable via l'API
        permissions.append(perm)
    group.permissions.set(permissions)
    return group
