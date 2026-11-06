"""Écriture du journal d'audit, avec masquage systématique des clés sensibles."""
from __future__ import annotations

import logging

from apps.core.net import request_ip_hash

from .models import AuditLog

logger = logging.getLogger("portfolio.security")
SENSITIVE_KEYS = ("password", "token", "secret", "csrf", "session", "cookie", "key")


def _clean(metadata: dict) -> dict:
    cleaned = {}
    for key, value in (metadata or {}).items():
        if any(word in key.lower() for word in SENSITIVE_KEYS):
            continue
        cleaned[key] = value if isinstance(value, (int, float, bool)) or value is None else str(value)[:200]
    return cleaned


def record(request, action: str, target=None, *, actor=None, **metadata) -> AuditLog:
    user = actor if actor is not None else getattr(request, "user", None)
    if user is not None and not user.is_authenticated:
        user = None
    entry = AuditLog.objects.create(
        actor=user,
        action=action,
        target_type=target._meta.label_lower if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        target_label=str(target)[:200] if target is not None else "",
        ip_hash=request_ip_hash(request) if request is not None else "",
        metadata=_clean(metadata),
    )
    logger.info(
        "audit action=%s actor_id=%s target=%s:%s",
        action,
        getattr(user, "pk", None),
        entry.target_type,
        entry.target_id,
    )
    return entry
