from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Trace des événements sensibles. Lecture seule depuis l'API ; jamais de secret dans `metadata`."""

    class Action(models.TextChoices):
        LOGIN_SUCCESS = "login_success", "Connexion réussie"
        LOGIN_FAILED = "login_failed", "Échec de connexion"
        LOGIN_LOCKED = "login_locked", "Compte temporairement verrouillé"
        LOGOUT = "logout", "Déconnexion"
        PASSWORD_CHANGED = "password_changed", "Mot de passe modifié"
        PASSWORD_RESET_REQUESTED = "password_reset_requested", "Réinitialisation demandée"
        PASSWORD_RESET_DONE = "password_reset_done", "Mot de passe réinitialisé"
        ADMIN_CREATED = "admin_created", "Compte administrateur créé"
        CREATE = "create", "Création"
        UPDATE = "update", "Modification"
        DELETE = "delete", "Suppression"
        UPLOAD = "upload", "Téléversement"
        CONTACT_SPAM = "contact_spam", "Message de contact bloqué (spam)"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_entries"
    )
    action = models.CharField(max_length=40, choices=Action.choices, db_index=True)
    target_type = models.CharField(max_length=60, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_label = models.CharField(max_length=200, blank=True)
    ip_hash = models.CharField(max_length=32, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("actor", "-created_at")), models.Index(fields=("action", "-created_at"))]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action}"
