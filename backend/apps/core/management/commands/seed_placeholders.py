"""
Initialise la base avec une structure vide et des données provisoires clairement identifiées.

Aucune information personnelle n'est inventée : les textes du profil sont marqués
« [À REMPLACER] » et les projets d'exemple portent l'indicateur `is_sample`, affiché
publiquement par la mention « Exemple ». Par défaut, rien d'exemple n'est publié.

    python manage.py seed_placeholders                       # structure seule (catégories)
    python manage.py seed_placeholders --with-samples        # + exemples non publiés
    python manage.py seed_placeholders --with-samples --publish-samples   # aperçu complet
"""
from __future__ import annotations

import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from apps.career.models import (
    Achievement,
    Certification,
    Education,
    Experience,
    Mission,
)
from apps.core.models import SiteProfile, SocialLink
from apps.core.services.uploads import store_image
from apps.projects.models import Category, Project, ProjectChallenge
from apps.skills.models import Skill, SkillCategory

SKILL_CATEGORIES = [
    ("frontend", "Frontend", "Frontend"),
    ("backend", "Backend", "Backend"),
    ("fullstack", "Full Stack", "Full Stack"),
    ("databases", "Bases de données", "Databases"),
    ("systems", "Systèmes et réseaux", "Systems & networks"),
    ("devops", "DevOps et automatisation", "DevOps & automation"),
    ("data", "Data Analytics", "Data analytics"),
    ("security", "Cybersécurité", "Cybersecurity"),
    ("tools", "Outils", "Tools"),
]
PROJECT_CATEGORIES = [
    ("frontend", "Frontend", "Frontend"),
    ("backend", "Backend", "Backend"),
    ("full-stack", "Full Stack", "Full Stack"),
    ("devops", "DevOps", "DevOps"),
    ("data", "Data", "Data"),
]
SAMPLE_PROJECTS = [
    ("exemple-application-web", "full-stack", "Application web d'exemple", "Sample web application", (59, 130, 246)),
    ("exemple-api-rest", "backend", "API REST d'exemple", "Sample REST API", (255, 69, 58)),
    ("exemple-tableau-de-bord", "frontend", "Interface d'exemple", "Sample interface", (120, 120, 140)),
]


def _fonts():
    """Police avec accents si disponible (DejaVu), sinon police intégrée de Pillow et texte sans accents."""
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(path, 44), ImageFont.truetype(path, 26), "Aperçu à remplacer — exemple non réel"
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=44), ImageFont.load_default(size=26), "Apercu a remplacer - exemple non reel"
    except TypeError:  # Pillow ancien
        default = ImageFont.load_default()
        return default, default, "Apercu a remplacer - exemple non reel"


def placeholder_image(label: str, accent: tuple[int, int, int]) -> SimpleUploadedFile:
    """Visuel neutre 16:10 généré localement, portant la mention « Aperçu à remplacer »."""
    width, height = 1600, 1000
    image = Image.new("RGB", (width, height), (8, 8, 10))
    glow = Image.new("RGB", (width, height), (0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((width * 0.15, height * 0.05, width * 0.85, height * 0.95), fill=accent)
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    image = Image.blend(image, glow, 0.22)
    draw = ImageDraw.Draw(image)
    # Fenêtre d'interface stylisée
    draw.rounded_rectangle((180, 150, 1420, 850), radius=28, outline=(60, 60, 68), width=3, fill=(14, 14, 17))
    draw.rounded_rectangle((180, 150, 1420, 220), radius=28, fill=(24, 24, 28))
    for i, color in enumerate(((255, 69, 58), (120, 120, 130), (59, 130, 246))):
        draw.ellipse((220 + i * 40, 172, 244 + i * 40, 196), fill=color)
    for row in range(5):
        y = 290 + row * 90
        draw.rounded_rectangle((260, y, 260 + 300 + (row % 3) * 180, y + 28), radius=14, fill=(34, 34, 40))
    draw.rounded_rectangle((980, 290, 1340, 740), radius=20, fill=(22, 22, 27), outline=accent, width=2)
    font, small, note = _fonts()
    draw.text((260, 760), label, fill=(240, 240, 240), font=font)
    draw.text((260, 815), note, fill=(161, 161, 170), font=small)
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return SimpleUploadedFile("placeholder.png", buffer.getvalue(), content_type="image/png")


class Command(BaseCommand):
    help = "Crée les catégories et, en option, des données d'exemple clairement identifiées."

    def add_arguments(self, parser):
        parser.add_argument("--with-samples", action="store_true", help="Ajoute des contenus d'exemple.")
        parser.add_argument("--publish-samples", action="store_true", help="Publie les contenus d'exemple (aperçu).")

    @transaction.atomic
    def handle(self, *args, **options):
        profile = SiteProfile.load()
        for order, (kind, fr, en) in enumerate(SKILL_CATEGORIES):
            SkillCategory.objects.update_or_create(
                slug=kind, defaults={"kind": kind, "name_fr": fr, "name_en": en, "display_order": order}
            )
        for order, (slug, fr, en) in enumerate(PROJECT_CATEGORIES):
            Category.objects.update_or_create(slug=slug, defaults={"name_fr": fr, "name_en": en, "display_order": order})
        self.stdout.write("Catégories de compétences et de projets prêtes.")

        if not options["with_samples"]:
            return
        publish = options["publish_samples"]
        self._profile(profile)
        self._samples(publish)
        self._social(profile, publish)
        state = "publiés" if publish else "non publiés"
        self.stdout.write(self.style.SUCCESS(f"Contenus d'exemple créés ({state}). Remplacez-les depuis le dashboard."))

    def _profile(self, profile: SiteProfile) -> None:
        defaults = {
            "tagline_fr": "[À REMPLACER] Une phrase d'accroche qui résume votre approche.",
            "tagline_en": "[TO REPLACE] A one-line tagline summarising your approach.",
            "short_bio_fr": "[À REMPLACER] Courte présentation de votre profil, en deux ou trois phrases.",
            "short_bio_en": "[TO REPLACE] Short introduction to your profile, in two or three sentences.",
            "about_fr": "[À REMPLACER] Votre parcours, votre façon de travailler et ce qui vous motive.",
            "about_en": "[TO REPLACE] Your background, how you work and what drives you.",
            "interests_fr": "[À REMPLACER] Vos centres d'intérêt techniques.",
            "interests_en": "[TO REPLACE] Your technical interests.",
            "vision_fr": "[À REMPLACER] Votre vision du développement logiciel.",
            "vision_en": "[TO REPLACE] Your vision of software development.",
            "approach_fr": "[À REMPLACER] Votre manière d'aborder un problème.",
            "approach_en": "[TO REPLACE] How you approach a problem.",
            "ambitions_fr": "[À REMPLACER] Vos ambitions professionnelles.",
            "ambitions_en": "[TO REPLACE] Your professional ambitions.",
            "expertise_fr": ["[Domaine 1]", "[Domaine 2]", "[Domaine 3]"],
            "expertise_en": ["[Area 1]", "[Area 2]", "[Area 3]"],
            "signature_fr": "[À REMPLACER] Signature professionnelle courte.",
            "signature_en": "[TO REPLACE] Short professional signature.",
            "location": "[À REMPLACER] Ville, pays",
        }
        changed = []
        for field, value in defaults.items():
            if not getattr(profile, field):
                setattr(profile, field, value)
                changed.append(field)
        if changed:
            profile.save()

    def _samples(self, publish: bool) -> None:
        stacks = [
            ["HTML", "CSS", "JavaScript", "Django", "PostgreSQL"],
            ["Python", "Django", "PostgreSQL", "Docker"],
            ["HTML", "CSS", "JavaScript"],
        ]
        for order, ((slug, category, fr, en, accent), stack) in enumerate(zip(SAMPLE_PROJECTS, stacks)):
            project, created = Project.objects.get_or_create(
                slug=slug,
                defaults={
                    "title_fr": f"[Exemple] {fr}",
                    "title_en": f"[Sample] {en}",
                    "summary_fr": "Projet fictif servant d'aperçu de mise en page. À remplacer par une réalisation réelle.",
                    "summary_en": "Fictional project used to preview the layout. Replace it with a real project.",
                    "context_fr": "[À REMPLACER] Contexte du projet : pour qui, dans quel cadre.",
                    "context_en": "[TO REPLACE] Project context: for whom, in what setting.",
                    "problem_fr": "[À REMPLACER] Le problème à résoudre.",
                    "problem_en": "[TO REPLACE] The problem to solve.",
                    "objectives_fr": "[À REMPLACER] Objectif 1\n[À REMPLACER] Objectif 2",
                    "objectives_en": "[TO REPLACE] Goal 1\n[TO REPLACE] Goal 2",
                    "features_fr": "[À REMPLACER] Fonctionnalité 1\n[À REMPLACER] Fonctionnalité 2",
                    "features_en": "[TO REPLACE] Feature 1\n[TO REPLACE] Feature 2",
                    "architecture_fr": "[À REMPLACER] Description de l'architecture technique.",
                    "architecture_en": "[TO REPLACE] Description of the technical architecture.",
                    "results_fr": "[À REMPLACER] Résultats obtenus, mesurés si possible.",
                    "results_en": "[TO REPLACE] Results achieved, measured if possible.",
                    "category": Category.objects.get(slug=category),
                    "is_sample": True,
                    "is_published": publish,
                    "display_order": order,
                    "cover_alt_fr": "Visuel d'exemple à remplacer",
                    "cover_alt_en": "Sample visual to replace",
                },
            )
            if created:
                # Compétences existantes portant ces noms (les autres sont ignorées).
                project.skills.set(Skill.objects.filter(name__in=stack))
                project.cover = store_image(placeholder_image(en, accent), "projects")
                project.save(update_fields=["cover"])
                ProjectChallenge.objects.create(
                    project=project,
                    challenge_fr="[À REMPLACER] Une difficulté rencontrée.",
                    challenge_en="[TO REPLACE] A challenge you faced.",
                    solution_fr="[À REMPLACER] La solution retenue.",
                    solution_en="[TO REPLACE] The chosen solution.",
                )
            elif publish and not project.is_published:
                project.is_published = True
                project.save(update_fields=["is_published"])

        for category in SkillCategory.objects.all():
            Skill.objects.get_or_create(
                category=category, name="[Exemple]", defaults={"is_published": publish}
            )

        experience, created = Experience.objects.get_or_create(
            title_fr="[EXEMPLE] Intitulé du poste",
            defaults={
                "title_en": "[SAMPLE] Job title",
                "organization": "[Entreprise à remplacer]",
                "start_date": date(2024, 1, 1),
                "summary_fr": "Remplacez cette expérience fictive par la vôtre.",
                "summary_en": "Replace this fictional experience with your own.",
                "is_published": publish,
            },
        )
        if created:
            Mission.objects.create(experience=experience, description_fr="[Exemple] Mission principale", description_en="[Sample] Main assignment")
        Education.objects.get_or_create(
            degree_fr="[EXEMPLE] Diplôme ou formation",
            defaults={"degree_en": "[SAMPLE] Degree", "institution": "[Établissement à remplacer]",
                      "start_date": date(2020, 9, 1), "end_date": date(2023, 6, 30), "is_published": publish},
        )
        Certification.objects.get_or_create(
            name="[EXEMPLE] Certification",
            defaults={"issuer": "[Organisme à remplacer]", "issued_on": date(2024, 6, 1), "is_published": publish},
        )
        Achievement.objects.get_or_create(
            title_fr="[EXEMPLE] Réalisation",
            defaults={"title_en": "[SAMPLE] Achievement", "date": date(2024, 3, 1),
                      "description_fr": "Remplacez cette réalisation fictive par la vôtre.",
                      "description_en": "Replace this fictional achievement with your own.", "is_published": publish},
        )
        if publish:  # republication des exemples existants lors d'une nouvelle exécution
            Skill.objects.filter(name="[Exemple]").update(is_published=True)
            Experience.objects.filter(title_fr__startswith="[EXEMPLE]").update(is_published=True)
            Education.objects.filter(degree_fr__startswith="[EXEMPLE]").update(is_published=True)
            Certification.objects.filter(name__startswith="[EXEMPLE]").update(is_published=True)
            Achievement.objects.filter(title_fr__startswith="[EXEMPLE]").update(is_published=True)

    def _social(self, profile: SiteProfile, publish: bool) -> None:
        for order, (platform, url) in enumerate([("github", "https://github.com/"), ("linkedin", "https://www.linkedin.com/")]):
            SocialLink.objects.get_or_create(
                profile=profile,
                platform=platform,
                defaults={"url": url, "label": "[À REMPLACER]", "is_published": publish, "display_order": order},
            )
