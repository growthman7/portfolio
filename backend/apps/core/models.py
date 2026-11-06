"""Modèles transverses : bases abstraites, fichiers téléversés, profil du portfolio."""
from __future__ import annotations

import uuid

from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

from .validators.text import validate_single_line
from .validators.urls import validate_public_https_url


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("créé le", auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        abstract = True


class PublishableModel(TimeStampedModel):
    is_published = models.BooleanField("publié", default=False, db_index=True)
    display_order = models.PositiveIntegerField("ordre d'affichage", default=0)

    class Meta:
        abstract = True
        ordering = ("display_order", "id")


class MediaAsset(TimeStampedModel):
    """
    Fichier téléversé puis validé et ré-encodé côté serveur.

    Les fichiers sont toujours nommés par UUID et rangés dans un dossier choisi par
    le serveur : aucun nom fourni par le client n'est utilisé dans un chemin.
    """

    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        PDF = "pdf", "Document PDF"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    folder = models.CharField(max_length=40)
    # Pour une image : {"webp": {"480": "chemin", ...}, "avif": {...}} ; pour un PDF : {"pdf": "chemin"}
    files = models.JSONField(default=dict)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    original_name = models.CharField(max_length=120, blank=True)  # affichage uniquement, jamais utilisé comme chemin

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("kind", "folder"))]

    def __str__(self) -> str:
        return f"{self.kind}:{self.id}"

    def relative_paths(self) -> list[str]:
        if self.kind == self.Kind.PDF:
            return [self.files["pdf"]] if self.files.get("pdf") else []
        paths: list[str] = []
        for variants in self.files.values():
            paths.extend(variants.values())
        return paths


class SiteProfile(TimeStampedModel):
    """Informations générales du portfolio. Une seule ligne autorisée (singleton)."""

    singleton = models.PositiveSmallIntegerField(default=1, unique=True, editable=False)

    first_name = models.CharField("prénom", max_length=80, validators=[validate_single_line])
    last_name = models.CharField("nom", max_length=80, validators=[validate_single_line])
    job_title_fr = models.CharField(max_length=120, validators=[validate_single_line])
    job_title_en = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    tagline_fr = models.CharField(max_length=200, blank=True)
    tagline_en = models.CharField(max_length=200, blank=True)
    short_bio_fr = models.TextField(max_length=600, blank=True)
    short_bio_en = models.TextField(max_length=600, blank=True)
    about_fr = models.TextField(max_length=4000, blank=True)
    about_en = models.TextField(max_length=4000, blank=True)
    interests_fr = models.TextField(max_length=2000, blank=True)
    interests_en = models.TextField(max_length=2000, blank=True)
    vision_fr = models.TextField(max_length=2000, blank=True)
    vision_en = models.TextField(max_length=2000, blank=True)
    approach_fr = models.TextField("manière d'aborder les problèmes", max_length=2000, blank=True)
    approach_en = models.TextField(max_length=2000, blank=True)
    ambitions_fr = models.TextField(max_length=2000, blank=True)
    ambitions_en = models.TextField(max_length=2000, blank=True)
    expertise_fr = models.JSONField(default=list, blank=True)
    expertise_en = models.JSONField(default=list, blank=True)
    signature_fr = models.CharField(max_length=160, blank=True)
    signature_en = models.CharField(max_length=160, blank=True)

    email_public = models.EmailField(blank=True)
    phone_public = models.CharField(
        "téléphone affiché publiquement", max_length=30, blank=True,
        validators=[RegexValidator(r"^\+?[0-9][0-9 .\-()]{5,28}$", "Numéro invalide : chiffres, espaces, + - . ( ) uniquement.")],
        help_text="Format international conseillé, ex. +225 01 52 16 17 69. Vide = non affiché.",
    )
    location = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    is_available = models.BooleanField("disponible pour de nouvelles opportunités", default=False)

    photo = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    photo_alt_fr = models.CharField(max_length=200, blank=True)
    photo_alt_en = models.CharField(max_length=200, blank=True)
    cv_fr = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    cv_en = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    # Second CV facultatif (ex. version « Data Analyst »), proposé en plus du CV principal.
    cv_alt = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    cv_alt_label_fr = models.CharField("intitulé du second CV", max_length=80, blank=True, validators=[validate_single_line])
    cv_alt_label_en = models.CharField(max_length=80, blank=True, validators=[validate_single_line])
    og_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    seo_title_fr = models.CharField(max_length=70, blank=True)
    seo_title_en = models.CharField(max_length=70, blank=True)
    seo_description_fr = models.CharField(max_length=170, blank=True)
    seo_description_en = models.CharField(max_length=170, blank=True)

    class Meta:
        verbose_name = "profil du portfolio"
        constraints = [models.CheckConstraint(condition=Q(singleton=1), name="siteprofile_singleton")]

    def __str__(self) -> str:
        return self.full_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @classmethod
    def load(cls) -> "SiteProfile":
        profile = cls.objects.select_related("photo", "cv_fr", "cv_en", "og_image").filter(singleton=1).first()
        if profile is None:
            profile = cls.objects.create(
                first_name="Prénom",
                last_name="Nom",
                job_title_fr="[À REMPLACER] Titre professionnel",
                job_title_en="[TO REPLACE] Job title",
            )
        return profile


class SocialLink(PublishableModel):
    class Platform(models.TextChoices):
        GITHUB = "github", "GitHub"
        GITLAB = "gitlab", "GitLab"
        LINKEDIN = "linkedin", "LinkedIn"
        X = "x", "X"
        MASTODON = "mastodon", "Mastodon"
        STACKOVERFLOW = "stackoverflow", "Stack Overflow"
        DEVTO = "devto", "DEV"
        MEDIUM = "medium", "Medium"
        WEBSITE = "website", "Site web"

    profile = models.ForeignKey(SiteProfile, on_delete=models.CASCADE, related_name="social_links")
    platform = models.CharField(max_length=20, choices=Platform.choices)
    url = models.URLField(max_length=300, validators=[validate_public_https_url])
    label = models.CharField(max_length=60, blank=True, validators=[validate_single_line])

    class Meta(PublishableModel.Meta):
        verbose_name = "réseau professionnel"
        indexes = [models.Index(fields=("profile", "display_order"))]

    def __str__(self) -> str:
        return f"{self.get_platform_display()} — {self.url}"
