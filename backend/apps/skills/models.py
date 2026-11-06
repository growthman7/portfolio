from django.db import models

from apps.core.models import PublishableModel, TimeStampedModel
from apps.core.validators.text import validate_single_line


class SkillCategory(TimeStampedModel):
    class Kind(models.TextChoices):
        FRONTEND = "frontend", "Frontend"
        BACKEND = "backend", "Backend"
        FULLSTACK = "fullstack", "Full Stack"
        DATABASES = "databases", "Bases de données"
        SYSTEMS = "systems", "Systèmes et réseaux"
        DEVOPS = "devops", "DevOps et automatisation"
        DATA = "data", "Data Analytics"
        SECURITY = "security", "Cybersécurité"
        TOOLS = "tools", "Outils"
        OTHER = "other", "Autre"

    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    name_fr = models.CharField(max_length=80, validators=[validate_single_line])
    name_en = models.CharField(max_length=80, blank=True, validators=[validate_single_line])
    slug = models.SlugField(max_length=80, unique=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("display_order", "id")
        verbose_name = "catégorie de compétences"

    def __str__(self) -> str:
        return self.name_fr


class Skill(PublishableModel):
    class Level(models.TextChoices):
        NOTIONS = "notions", "Notions"
        INTERMEDIATE = "intermediate", "Intermédiaire"
        ADVANCED = "advanced", "Avancé"
        EXPERT = "expert", "Expert"

    category = models.ForeignKey(SkillCategory, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=60, validators=[validate_single_line])
    # Le niveau est facultatif : il n'est affiché que s'il a été renseigné par l'administrateur.
    level = models.CharField(max_length=20, choices=Level.choices, blank=True)
    years = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta(PublishableModel.Meta):
        verbose_name = "compétence"
        constraints = [models.UniqueConstraint(fields=("category", "name"), name="skill_unique_per_category")]
        indexes = [models.Index(fields=("category", "is_published", "display_order"))]

    def __str__(self) -> str:
        return self.name
