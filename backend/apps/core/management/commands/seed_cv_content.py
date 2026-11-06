"""
Charge le contenu réel du CV (profil, compétences, parcours, projets) et les CV en PDF dans la base.

Source : CV de Marc-Aurel Brouzro Koigny (versions « Développeur Full Stack » et « Data Analyst »).
La commande est idempotente : relancée, elle met à jour les entrées au lieu de les dupliquer.

    python manage.py seed_cv_content                       # crée / met à jour, publié
    python manage.py seed_cv_content --unpublish-samples   # masque aussi les projets/exemples [EXEMPLE]
    python manage.py seed_cv_content --cv "chemin/CV.pdf" --cv-alt "chemin/CV_data.pdf"
        # CV principal (bouton « Télécharger mon CV ») et second CV facultatif ; les PDF passent
        # par la même validation que les téléversements du dashboard (taille, signature, contenu actif).
"""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from apps.career.models import (
    Achievement,
    Certification,
    Education,
    Experience,
    Mission,
)
from apps.core.models import SiteProfile, SocialLink
from apps.core.services.uploads import delete_asset, store_pdf
from apps.projects.models import Category, Project, Technology
from apps.skills.models import Skill, SkillCategory

# --- Profil (hero, À propos, pied de page, SEO) ------------------------------------------------
# Uniquement des informations présentes dans les CV. Les champs sans source (vision, méthode,
# ambitions) sont vidés : une section vide n'est pas affichée, plutôt qu'un texte « [À REMPLACER] ».
PROFILE = {
    "first_name": "Marc-Aurel",
    "last_name": "Brouzro",
    "job_title_fr": "Développeur Full Stack | Data Analyst | Administrateur Systèmes",
    "job_title_en": "Full Stack Developer | Data Analyst | Systems Administrator",
    "tagline_fr": "",
    "tagline_en": "",
    "short_bio_fr": (
        "Jeune diplômé en Génie Informatique spécialisé en développement Full Stack, avec une solide expertise "
        "en automatisation, intégration continue et déploiement, et une forte capacité d'adaptation aux "
        "architectures cloud modernes."
    ),
    "short_bio_en": (
        "Recent Computer Engineering graduate specialising in full stack development, with solid skills in "
        "automation, continuous integration and deployment, and a strong ability to adapt to modern cloud architectures."
    ),
    "about_fr": (
        "Diplômé d'une Licence en Génie Informatique à l'Institut Universitaire d'Abidjan, je poursuis en Master 1 "
        "Mobiquité, Big Data et Cloud à l'ESATIC.\n"
        "En stage chez FIRCA, j'ai participé à la conception et au développement d'une application web de gestion "
        "du parc automobile : demandes de véhicules, attribution des véhicules et des chauffeurs, classement des chauffeurs. "
        "Chez COMTEL, j'ai déployé GLPI pour l'inventaire du parc informatique et le suivi des incidents.\n"
        "J'associe développement web, analyse de données et administration de systèmes."
    ),
    "about_en": (
        "I hold a Bachelor's degree in Computer Engineering from the Institut Universitaire d'Abidjan and I am now in "
        "the first year of a Master's in Mobiquity, Big Data and Cloud at ESATIC.\n"
        "During my internship at FIRCA, I helped design and build a fleet management web application: vehicle requests, "
        "vehicle and driver assignment, driver ranking. At COMTEL, I deployed GLPI for IT inventory and incident tracking.\n"
        "I combine web development, data analysis and systems administration."
    ),
    "interests_fr": "Big Data, cloud et mobiquité.\nEn dehors du code : lecture, sport, photographie et vidéographie.",
    "interests_en": "Big Data, cloud and mobiquity.\nAway from code: reading, sport, photography and videography.",
    "vision_fr": "", "vision_en": "",
    "approach_fr": "", "approach_en": "",
    "ambitions_fr": "", "ambitions_en": "",
    "expertise_fr": ["Développement Full Stack", "Analyse de données", "Administration systèmes"],
    "expertise_en": ["Full stack development", "Data analysis", "Systems administration"],
    "signature_fr": "Développeur Full Stack · Data Analyst · Abidjan",
    "signature_en": "Full Stack Developer · Data Analyst · Abidjan",
    "email_public": "marcaurelbrouzro@gmail.com",
    "phone_public": "+225 01 52 16 17 69",
    "location": "Abidjan, Côte d'Ivoire",
    "is_available": True,
    "cv_alt_label_fr": "CV Data Analyst",
    "cv_alt_label_en": "Data Analyst résumé (FR)",
}

# --- Compétences : (kind, nom FR, nom EN, [(compétence, niveau), ...]) -------------------------
# Niveaux : notions | intermediate | advanced | expert — à ajuster depuis le dashboard.
SKILLS = [
    ("frontend", "Développement Frontend", "Frontend development", [
        ("HTML & CSS", "advanced"),
        ("JavaScript", "intermediate"),
        ("React.js", "intermediate"),
        ("Bootstrap", "advanced"),
    ]),
    ("backend", "Développement Backend", "Backend development", [
        ("PHP", "advanced"),
        ("Laravel", "advanced"),
        ("Node.js", "intermediate"),
    ]),
    ("databases", "Bases de données", "Databases", [
        ("SQL", "advanced"),
        ("MySQL", "advanced"),
        ("Merise", "advanced"),
        ("UML", "intermediate"),
        ("NoSQL", "notions"),
    ]),
    ("systems", "Systèmes et réseaux", "Systems & networks", [
        ("Administration système", "intermediate"),
        ("Linux", "intermediate"),
        ("GLPI", "advanced"),
    ]),
    ("devops", "DevOps et automatisation", "DevOps & automation", [
        ("Intégration continue", "notions"),
        ("Déploiement", "notions"),
    ]),
    ("data", "Data Analytics", "Data analytics", [
        ("Excel (TCD, graphiques croisés)", "advanced"),
        ("Power BI", "intermediate"),
        ("Python", "intermediate"),
        ("Statistiques", "intermediate"),
        ("Tableau", "notions"),
    ]),
    ("tools", "Outils et environnements", "Tools", [
        ("Word", "advanced"),
        ("Excel", "advanced"),
    ]),
]

# --- Parcours --------------------------------------------------------------------------------
EXPERIENCES = [
    {
        "kind": "internship",
        "title_fr": "Stagiaire Développeur Full Stack",
        "title_en": "Full Stack Developer Intern",
        "organization": "FIRCA",
        "location": "Abidjan, Côte d'Ivoire",
        "start_date": date(2025, 8, 1),
        "end_date": date(2026, 1, 31),
        "summary_fr": "Conception et développement d'une application web de gestion du parc automobile.",
        "summary_en": "Design and development of a web application to manage the vehicle fleet.",
        "missions": [
            ("Participation à la conception et au développement d'une solution de gestion du parc automobile",
             "Took part in designing and building a fleet management solution"),
            ("Développement d'un module de gestion des demandes de véhicules",
             "Built a vehicle request management module"),
            ("Gestion de l'attribution des véhicules et des chauffeurs",
             "Handled vehicle and driver assignment"),
            ("Mise en place d'un système de classement des chauffeurs",
             "Implemented a driver ranking system"),
            ("Enregistrement et gestion des informations relatives aux véhicules",
             "Recorded and managed vehicle information"),
            ("Participation à la conception de la base de données et manipulation de données",
             "Contributed to database design and data handling"),
        ],
        "technologies": [],
    },
    {
        "kind": "internship",
        "title_fr": "Stagiaire Administrateur Systèmes",
        "title_en": "Systems Administrator Intern",
        "organization": "COMTEL",
        "location": "Abidjan, Côte d'Ivoire",
        "start_date": date(2024, 7, 1),
        "end_date": date(2024, 9, 30),
        "summary_fr": "Mise en place d'un outil de gestion du parc informatique et du support utilisateurs.",
        "summary_en": "Set up an IT asset management and user support tool.",
        "missions": [
            ("Installation et configuration de GLPI (Gestionnaire Libre de Parc Informatique)",
             "Installed and configured GLPI (IT asset management)"),
            ("Déploiement d'agents GLPI sur les postes clients",
             "Deployed GLPI agents on client workstations"),
            ("Gestion des tickets d'incidents et de demandes", "Handled incident and request tickets"),
            ("Réalisation de l'inventaire du parc informatique", "Carried out the IT inventory"),
        ],
        "technologies": ["GLPI"],
    },
]

EDUCATIONS = [
    {
        "degree_fr": "Master 1 — Mobiquité, Big Data et Cloud",
        "degree_en": "Master's year 1 — Mobiquity, Big Data and Cloud",
        "institution": "ESATIC",
        "location": "Abidjan",
        "start_date": date(2026, 10, 1),
        "end_date": None,
        "is_degree": False,
    },
    {
        "degree_fr": "Licence en Génie Informatique",
        "degree_en": "Bachelor's degree in Computer Engineering",
        "institution": "Institut Universitaire d'Abidjan",
        "location": "Abidjan",
        "start_date": date(2023, 10, 10),
        "end_date": date(2026, 6, 26),
        "is_degree": True,
    },
    {
        "degree_fr": "Baccalauréat série C",
        "degree_en": "Baccalaureate (Mathematics & Physical Sciences)",
        "institution": "Cours Secondaire Méthodiste de Cocody",
        "location": "Abidjan",
        "start_date": date(2022, 9, 1),
        "end_date": date(2023, 7, 31),
        "is_degree": True,
    },
]

# --- Projets ---------------------------------------------------------------------------------
PROJECT_CATEGORIES = [("full-stack", "Full Stack", "Full Stack"), ("data", "Data", "Data"), ("systemes", "Systèmes", "Systems")]

PROJECTS = [
    {
        "slug": "gestion-parc-automobile-firca",
        "category": "full-stack",
        "title_fr": "Gestion du parc automobile",
        "title_en": "Vehicle fleet management",
        "summary_fr": "Application web de gestion de flotte réalisée en stage chez FIRCA : demandes de véhicules, attribution des chauffeurs et classement.",
        "summary_en": "Fleet management web app built during an internship at FIRCA: vehicle requests, driver assignment and ranking.",
        "context_fr": "Projet réalisé pendant mon stage de développeur full stack à la FIRCA (Abidjan), d'août 2025 à janvier 2026.",
        "context_en": "Project carried out during my full stack developer internship at FIRCA (Abidjan), from August 2025 to January 2026.",
        "problem_fr": "Centraliser la gestion des véhicules de service, des demandes de déplacement et de l'affectation des chauffeurs.",
        "problem_en": "Centralise the management of service vehicles, trip requests and driver assignment.",
        "objectives_fr": "Suivre les véhicules et leurs informations\nTraiter les demandes de véhicules\nAffecter véhicules et chauffeurs",
        "objectives_en": "Track vehicles and their information\nProcess vehicle requests\nAssign vehicles and drivers",
        "features_fr": "Module de gestion des demandes de véhicules\nAttribution des véhicules et des chauffeurs\nSystème de classement des chauffeurs\nEnregistrement et gestion des informations des véhicules",
        "features_en": "Vehicle request management module\nVehicle and driver assignment\nDriver ranking system\nVehicle information management",
        "started_on": date(2025, 8, 1),
        "ended_on": date(2026, 1, 31),
        "is_featured": True,
        "technologies": [],
    },
    {
        "slug": "deploiement-glpi-comtel",
        "category": "systemes",
        "title_fr": "Déploiement de GLPI",
        "title_en": "GLPI deployment",
        "summary_fr": "Installation de GLPI et déploiement d'agents sur les postes chez COMTEL pour l'inventaire du parc et le suivi des incidents.",
        "summary_en": "GLPI installation and agent rollout at COMTEL for IT inventory and incident tracking.",
        "context_fr": "Projet réalisé pendant mon stage d'administrateur systèmes chez COMTEL (Abidjan), de juillet à septembre 2024.",
        "context_en": "Project carried out during my systems administrator internship at COMTEL (Abidjan), July to September 2024.",
        "problem_fr": "Disposer d'un inventaire fiable du parc informatique et d'un suivi structuré des incidents et des demandes.",
        "problem_en": "Get a reliable IT inventory and structured tracking of incidents and requests.",
        "objectives_fr": "Inventorier le parc informatique\nStructurer le support utilisateurs par tickets",
        "objectives_en": "Inventory the IT assets\nStructure user support with tickets",
        "features_fr": "Installation et configuration de GLPI\nDéploiement d'agents GLPI sur les postes clients\nGestion des tickets d'incidents et de demandes\nInventaire du parc informatique",
        "features_en": "GLPI installation and configuration\nGLPI agent rollout on workstations\nIncident and request ticketing\nIT inventory",
        "started_on": date(2024, 7, 1),
        "ended_on": date(2024, 9, 30),
        "is_featured": False,
        "technologies": ["GLPI"],
    },
    {
        "slug": "analyse-donnees-tableaux-de-bord",
        "category": "data",
        "title_fr": "Analyse de données et tableaux de bord",
        "title_en": "Data analysis and dashboards",
        "summary_fr": "Projet personnel : nettoyage de jeux de données et création de tableaux de bord interactifs.",
        "summary_en": "Personal project: dataset cleaning and interactive dashboards.",
        "context_fr": "Projet personnel mené pour approfondir l'analyse de données.",
        "context_en": "Personal project to deepen my data analysis skills.",
        "features_fr": "Nettoyage de jeux de données\nCréation de tableaux de bord interactifs\nTableaux et graphiques croisés dynamiques",
        "features_en": "Dataset cleaning\nInteractive dashboards\nPivot tables and pivot charts",
        "started_on": date(2026, 1, 1),
        "ended_on": None,
        "is_featured": False,
        "technologies": ["Excel", "Power BI"],
    },
]


OPEN_DESTINATION = re.compile(rb"/OpenAction\s*\[[^\]\[<>]*\]")


def _neutralize_open_destination(data: bytes) -> bytes:
    """
    Certains générateurs (jsPDF) ajoutent « /OpenAction [3 0 R /FitH null] » : une simple destination
    d'ouverture (page 1, pleine largeur), refusée par le contrôle anti-contenu actif car /OpenAction
    peut aussi déclencher un script. Seule la forme « tableau de destination » est effacée, remplacée par
    des espaces de même longueur (les positions de la table xref restent exactes). Une action sous forme
    de dictionnaire (<< /S /JavaScript … >>) n'est pas touchée et reste refusée par la validation.
    """
    return OPEN_DESTINATION.sub(lambda m: b" " * len(m.group(0)), data)


def _tech(name: str) -> Technology:
    return Technology.objects.get_or_create(slug=slugify(name), defaults={"name": name})[0]


class Command(BaseCommand):
    help = "Charge les compétences, le parcours et les projets issus du CV."

    def add_arguments(self, parser):
        parser.add_argument("--unpublish-samples", action="store_true",
                            help="Dépublie les contenus d'exemple créés par seed_placeholders.")
        parser.add_argument("--cv", help="PDF du CV principal (bouton « Télécharger mon CV »).")
        parser.add_argument("--cv-alt", help="PDF du second CV, facultatif (ex. version Data Analyst).")
        parser.add_argument("--linkedin", help="Adresse du profil LinkedIn (https://www.linkedin.com/in/…).")
        parser.add_argument("--github", help="Adresse du compte GitHub (https://github.com/…).")

    @transaction.atomic
    def handle(self, *args, **options):
        self._profile(options.get("cv"), options.get("cv_alt"))
        self._social_links({"linkedin": options.get("linkedin"), "github": options.get("github")})
        self._skills()
        self._career()
        self._projects()
        if options["unpublish_samples"]:
            Project.objects.filter(is_sample=True).update(is_published=False)
            Skill.objects.filter(name="[Exemple]").update(is_published=False)
            Experience.objects.filter(title_fr__startswith="[EXEMPLE]").update(is_published=False)
            Education.objects.filter(degree_fr__startswith="[EXEMPLE]").update(is_published=False)
            Certification.objects.filter(name__startswith="[EXEMPLE]").update(is_published=False)
            Achievement.objects.filter(title_fr__startswith="[EXEMPLE]").update(is_published=False)
        self.stdout.write(self.style.SUCCESS("Contenu du CV chargé et publié."))

    def _profile(self, cv_path: str | None, cv_alt_path: str | None) -> None:
        profile = SiteProfile.load()
        for field, value in PROFILE.items():
            setattr(profile, field, value)
        profile.full_clean(exclude=["photo", "cv_fr", "cv_en", "cv_alt", "og_image"])
        profile.save()
        for field, path in (("cv_fr", cv_path), ("cv_alt", cv_alt_path)):
            if path:
                self._attach_pdf(profile, field, Path(path))

    def _social_links(self, urls: dict[str, str | None]) -> None:
        """Crée ou met à jour les liens LinkedIn / GitHub fournis (validés : https, domaine public)."""
        profile = SiteProfile.load()
        order = {"linkedin": 0, "github": 1}
        for platform, url in urls.items():
            if not url:
                continue
            link = SocialLink.objects.filter(profile=profile, platform=platform).first() or SocialLink(profile=profile, platform=platform)
            link.url, link.label, link.is_published, link.display_order = url, "", True, order[platform]
            try:
                link.full_clean()
            except ValidationError as error:
                raise CommandError(f"Adresse {platform} refusée : {' '.join(error.messages)}") from error
            link.save()
            self.stdout.write(self.style.SUCCESS(f"{platform} : {url}"))

    def _attach_pdf(self, profile: SiteProfile, field: str, path: Path) -> None:
        """Enregistre le PDF comme un téléversement du dashboard ; ne fait rien s'il est déjà en place."""
        if not path.is_file():
            raise CommandError(f"Fichier introuvable : {path}")
        data = _neutralize_open_destination(path.read_bytes())
        current = getattr(profile, field)
        if current and current.original_name == path.name and current.size_bytes == len(data):
            self.stdout.write(f"{field} : déjà à jour ({path.name}).")
            return
        upload = SimpleUploadedFile(path.name, data, content_type="application/pdf")
        try:
            asset = store_pdf(upload, "cv")
        except ValidationError as error:
            raise CommandError(f"{path.name} refusé : {' '.join(error.messages)}") from error
        setattr(profile, field, asset)
        profile.save(update_fields=[field, "updated_at"])
        delete_asset(current)
        self.stdout.write(self.style.SUCCESS(f"{field} : {path.name} publié ({len(data) // 1024} Ko)."))

    def _skills(self) -> None:
        for order, (kind, fr, en, skills) in enumerate(SKILLS):
            category, _ = SkillCategory.objects.update_or_create(
                slug=kind, defaults={"kind": kind, "name_fr": fr, "name_en": en, "display_order": order}
            )
            for position, (name, level) in enumerate(skills):
                Skill.objects.update_or_create(
                    category=category, name=name,
                    defaults={"level": level, "display_order": position, "is_published": True},
                )

    def _career(self) -> None:
        for order, data in enumerate(EXPERIENCES):
            data = dict(data)
            missions, techs = data.pop("missions"), data.pop("technologies")
            experience, _ = Experience.objects.update_or_create(
                organization=data["organization"], title_fr=data["title_fr"],
                defaults={**data, "display_order": order, "is_published": True},
            )
            experience.missions.all().delete()
            for position, (fr, en) in enumerate(missions):
                Mission.objects.create(experience=experience, description_fr=fr, description_en=en, display_order=position)
            experience.technologies.set([_tech(name) for name in techs])

        for order, data in enumerate(EDUCATIONS):
            Education.objects.update_or_create(
                institution=data["institution"], degree_fr=data["degree_fr"],
                defaults={**data, "display_order": order, "is_published": True},
            )

    def _projects(self) -> None:
        for order, (slug, fr, en) in enumerate(PROJECT_CATEGORIES, start=10):
            Category.objects.get_or_create(slug=slug, defaults={"name_fr": fr, "name_en": en, "display_order": order})
        for order, data in enumerate(PROJECTS):
            data = dict(data)
            techs = data.pop("technologies")
            category = Category.objects.get(slug=data.pop("category"))
            project, _ = Project.objects.update_or_create(
                slug=data.pop("slug"),
                defaults={**data, "category": category, "is_sample": False, "is_published": True, "display_order": order},
            )
            project.technologies.set([_tech(name) for name in techs])
