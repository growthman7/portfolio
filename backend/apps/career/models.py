from django.db import models
from django.db.models import F, Q

from apps.core.models import PublishableModel, TimeStampedModel
from apps.core.validators.text import validate_single_line
from apps.core.validators.urls import validate_public_https_url
from apps.projects.models import Technology


def _dates_constraint(name: str, start: str, end: str) -> models.CheckConstraint:
    return models.CheckConstraint(
        condition=Q(**{f"{end}__isnull": True}) | Q(**{f"{end}__gte": F(start)}),
        name=name,
    )


class Experience(PublishableModel):
    class Kind(models.TextChoices):
        JOB = "job", "Emploi"
        INTERNSHIP = "internship", "Stage"
        APPRENTICESHIP = "apprenticeship", "Alternance"
        FREELANCE = "freelance", "Freelance"
        VOLUNTEER = "volunteer", "Bénévolat"

    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.JOB)
    title_fr = models.CharField(max_length=120, validators=[validate_single_line])
    title_en = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    organization = models.CharField(max_length=120, validators=[validate_single_line])
    location = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True, help_text="Vide = poste en cours.")
    summary_fr = models.TextField(max_length=2000, blank=True)
    summary_en = models.TextField(max_length=2000, blank=True)
    technologies = models.ManyToManyField(Technology, blank=True, related_name="experiences")

    class Meta:
        ordering = ("-start_date", "display_order")
        verbose_name = "expérience"
        constraints = [_dates_constraint("experience_dates_ordered", "start_date", "end_date")]
        indexes = [models.Index(fields=("is_published", "-start_date"))]

    def __str__(self) -> str:
        return f"{self.title_fr} — {self.organization}"


class Mission(TimeStampedModel):
    experience = models.ForeignKey(Experience, on_delete=models.CASCADE, related_name="missions")
    description_fr = models.CharField(max_length=400)
    description_en = models.CharField(max_length=400, blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("display_order", "id")

    def __str__(self) -> str:
        return self.description_fr[:60]


class Education(PublishableModel):
    degree_fr = models.CharField("diplôme / formation", max_length=160, validators=[validate_single_line])
    degree_en = models.CharField(max_length=160, blank=True, validators=[validate_single_line])
    field_fr = models.CharField("spécialité", max_length=160, blank=True, validators=[validate_single_line])
    field_en = models.CharField(max_length=160, blank=True, validators=[validate_single_line])
    institution = models.CharField(max_length=160, validators=[validate_single_line])
    location = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_degree = models.BooleanField("diplôme obtenu", default=False)
    description_fr = models.TextField(max_length=2000, blank=True)
    description_en = models.TextField(max_length=2000, blank=True)

    class Meta:
        ordering = ("-end_date", "-start_date", "display_order")
        verbose_name = "formation"
        constraints = [
            models.CheckConstraint(
                condition=Q(start_date__isnull=True) | Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")),
                name="education_dates_ordered",
            )
        ]

    def __str__(self) -> str:
        return f"{self.degree_fr} — {self.institution}"


class Certification(PublishableModel):
    name = models.CharField(max_length=160, validators=[validate_single_line])
    issuer = models.CharField(max_length=120, validators=[validate_single_line])
    issued_on = models.DateField()
    expires_on = models.DateField(null=True, blank=True)
    credential_id = models.CharField(max_length=120, blank=True, validators=[validate_single_line])
    credential_url = models.URLField(max_length=300, blank=True, validators=[validate_public_https_url])

    class Meta:
        ordering = ("-issued_on", "display_order")
        verbose_name = "certification"
        constraints = [_dates_constraint("certification_dates_ordered", "issued_on", "expires_on")]

    def __str__(self) -> str:
        return f"{self.name} ({self.issuer})"


class Achievement(PublishableModel):
    """Réalisation marquante (prix, publication, contribution, hackathon…)."""

    title_fr = models.CharField("intitulé", max_length=160, validators=[validate_single_line])
    title_en = models.CharField(max_length=160, blank=True, validators=[validate_single_line])
    date = models.DateField(null=True, blank=True)
    description_fr = models.TextField(max_length=1500, blank=True)
    description_en = models.TextField(max_length=1500, blank=True)
    url = models.URLField(max_length=300, blank=True, validators=[validate_public_https_url])

    class Meta:
        ordering = ("-date", "display_order")
        verbose_name = "réalisation"

    def __str__(self) -> str:
        return self.title_fr
