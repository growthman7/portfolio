from django.db import models
from django.db.models import F, Q

from apps.core.models import MediaAsset, PublishableModel, TimeStampedModel
from apps.core.validators.text import validate_single_line
from apps.core.validators.urls import validate_public_https_url


class Category(TimeStampedModel):
    """Catégorie de projet (Frontend, Backend, Full Stack, DevOps, Data…)."""

    name_fr = models.CharField(max_length=60, validators=[validate_single_line])
    name_en = models.CharField(max_length=60, blank=True, validators=[validate_single_line])
    slug = models.SlugField(max_length=60, unique=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("display_order", "name_fr")
        verbose_name = "catégorie de projet"
        verbose_name_plural = "catégories de projets"

    def __str__(self) -> str:
        return self.name_fr


class Technology(TimeStampedModel):
    name = models.CharField(max_length=60, unique=True, validators=[validate_single_line])
    slug = models.SlugField(max_length=60, unique=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "technologie"
        verbose_name_plural = "technologies"

    def __str__(self) -> str:
        return self.name


class Project(PublishableModel):
    title_fr = models.CharField(max_length=120, validators=[validate_single_line])
    title_en = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    slug = models.SlugField(max_length=120, unique=True)
    summary_fr = models.CharField("résumé (carte)", max_length=280)
    summary_en = models.CharField(max_length=280, blank=True)
    # Étude de cas : un champ par chapitre de la page de détail (un chapitre vide n'est pas affiché).
    context_fr = models.TextField("contexte", max_length=4000, blank=True)
    context_en = models.TextField(max_length=4000, blank=True)
    problem_fr = models.TextField("problématique", max_length=3000, blank=True)
    problem_en = models.TextField(max_length=3000, blank=True)
    objectives_fr = models.TextField("objectifs (un par ligne)", max_length=3000, blank=True)
    objectives_en = models.TextField(max_length=3000, blank=True)
    features_fr = models.TextField("fonctionnalités (une par ligne)", max_length=4000, blank=True)
    features_en = models.TextField(max_length=4000, blank=True)
    architecture_fr = models.TextField("architecture technique", max_length=4000, blank=True)
    architecture_en = models.TextField(max_length=4000, blank=True)
    results_fr = models.TextField("résultats", max_length=3000, blank=True)
    results_en = models.TextField(max_length=3000, blank=True)

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="projects")
    # Compétences mises en œuvre (affichées comme « Technologies » sur le site public).
    skills = models.ManyToManyField("skills.Skill", blank=True, related_name="projects")
    cover = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    cover_alt_fr = models.CharField(max_length=200, blank=True)
    cover_alt_en = models.CharField(max_length=200, blank=True)
    architecture_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    architecture_alt_fr = models.CharField(max_length=200, blank=True)
    architecture_alt_en = models.CharField(max_length=200, blank=True)

    demo_url = models.URLField(max_length=300, blank=True, validators=[validate_public_https_url])
    repo_url = models.URLField(max_length=300, blank=True, validators=[validate_public_https_url])
    started_on = models.DateField(null=True, blank=True)
    ended_on = models.DateField(null=True, blank=True)
    is_featured = models.BooleanField("mis en avant", default=False)
    is_sample = models.BooleanField(
        "exemple fictif",
        default=False,
        help_text="Projet de démonstration : affiché avec la mention « Exemple » et jamais présenté comme réel.",
    )

    class Meta(PublishableModel.Meta):
        verbose_name = "projet"
        indexes = [
            models.Index(fields=("is_published", "display_order")),
            models.Index(fields=("category", "is_published")),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(ended_on__isnull=True) | Q(started_on__isnull=True) | Q(ended_on__gte=F("started_on")),
                name="project_dates_ordered",
            )
        ]

    def __str__(self) -> str:
        return self.title_fr


class ProjectImage(TimeStampedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="images")
    asset = models.ForeignKey(MediaAsset, on_delete=models.CASCADE, related_name="+")
    alt_fr = models.CharField(max_length=200, blank=True)
    alt_en = models.CharField(max_length=200, blank=True)
    caption_fr = models.CharField(max_length=200, blank=True)
    caption_en = models.CharField(max_length=200, blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("display_order", "id")
        indexes = [models.Index(fields=("project", "display_order"))]

    def __str__(self) -> str:
        return f"Image {self.pk} — {self.project}"


class ProjectChallenge(TimeStampedModel):
    """Paire « difficulté rencontrée / solution apportée » du chapitre 8."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="challenges")
    challenge_fr = models.CharField("difficulté", max_length=500)
    challenge_en = models.CharField(max_length=500, blank=True)
    solution_fr = models.CharField("solution", max_length=800)
    solution_en = models.CharField(max_length=800, blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("display_order", "id")

    def __str__(self) -> str:
        return self.challenge_fr[:60]
