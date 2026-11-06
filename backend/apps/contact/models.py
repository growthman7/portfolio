from django.db import models

from apps.core.models import TimeStampedModel
from apps.core.validators.text import validate_no_control_chars, validate_single_line


class ContactMessage(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", "Nouveau"
        READ = "read", "Lu"
        ARCHIVED = "archived", "Archivé"
        SPAM = "spam", "Indésirable"

    name = models.CharField(max_length=100, validators=[validate_single_line])
    email = models.EmailField(max_length=254)
    subject = models.CharField(max_length=150, validators=[validate_single_line])
    message = models.TextField(max_length=5000, validators=[validate_no_control_chars])
    language = models.CharField(max_length=2, default="fr")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    ip_hash = models.CharField(max_length=32, blank=True)  # IP pseudonymisée (jamais en clair)
    user_agent = models.CharField(max_length=200, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "message de contact"
        indexes = [models.Index(fields=("status", "-created_at"))]

    def __str__(self) -> str:
        return f"{self.name} — {self.subject}"
